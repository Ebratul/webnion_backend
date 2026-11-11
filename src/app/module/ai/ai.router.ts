import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';
import { agentJson } from '../../lib/agent.js';
import { auth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { AppError } from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ActivityLogService, clientIp } from '../activity-log/activity-log.service.js';
import { AiChat } from './ai.chat.js';
import { AiDocuments } from './ai.documents.js';
import { AiIndex } from './ai.index.js';
import { retrievalConfig } from './ai.payload.js';
import { AiSettings, checkProvider, readKey, slotReady } from './ai.settings.js';
import { AiStudio } from './ai.studio.js';
import { AiUsage } from './ai.usage.js';
import { AiValidation, writeSchema, type ModelSlot } from './ai.validation.js';

export const AiRouter = Router();

// On top of the daily limits in AI Settings: a person typing does not send more than this
const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many messages. Please wait a minute.' },
});

const studioLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => config.isTest, validate: { xForwardedForHeader: false } });

const admin = auth('ADMIN');
const team = auth();

const actor = (req: Parameters<typeof clientIp>[0]) => ({ actorId: req.user!.id, actorName: req.user!.name, actorEmail: req.user!.email, ip: clientIp(req) });

// Public: whether to show the chat button, and its greeting
AiRouter.get(
  '/public-config',
  catchAsync(async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=30');
    sendResponse(res, 200, 'AI settings retrieved', await AiChat.publicConfig(getLocale(req), 'public'));
  }),
);

AiRouter.post('/chat', chatLimiter, validateRequest({ body: AiValidation.chat }), catchAsync((req, res) => AiChat.stream(req, res, 'public')));

AiRouter.get(
  '/admin-config',
  team,
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'AI settings retrieved', await AiChat.publicConfig(getLocale(req), 'admin'));
  }),
);
AiRouter.post('/chat/admin', team, chatLimiter, validateRequest({ body: AiValidation.chat }), catchAsync((req, res) => AiChat.stream(req, res, 'admin')));

AiRouter.get(
  '/settings',
  admin,
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'AI settings retrieved', await AiSettings.getForAdmin());
  }),
);

AiRouter.patch(
  '/settings',
  admin,
  validateRequest({ body: AiValidation.update }),
  catchAsync(async (req, res) => {
    const { changes } = await AiSettings.update(req.body);
    AiDocuments.clearCache();
    // Only what changed is logged, never a key
    await ActivityLogService.record({ ...actor(req), action: 'UPDATE', resource: 'ai', summary: 'Updated AI settings', details: changes.length ? `Changed: ${[...new Set(changes)].join('; ')}`.slice(0, 1000) : undefined });
    sendResponse(res, 200, 'AI settings saved', await AiSettings.getForAdmin());
  }),
);

// Tests the values in the form, saved or not. A key left empty means the saved one.
AiRouter.post(
  '/settings/test',
  admin,
  studioLimiter,
  validateRequest({ body: AiValidation.test }),
  catchAsync(async (req, res) => {
    const input = req.body as { slot: ModelSlot; provider: string; model: string; apiKey?: string; baseUrl?: string; hfProvider?: string; makePicture?: boolean };
    const value = await AiSettings.load();
    const saved = value.models[input.slot];
    await checkProvider(input.slot, input.provider, input.baseUrl || undefined);
    const apiKey = input.apiKey || readKey(saved, input.slot) || '';
    if (!apiKey && input.provider !== 'fake') throw new AppError(400, 'Paste the API key, or save one first');

    const kind = input.slot === 'image' ? 'image' : input.slot === 'embedding' ? 'embedding' : 'chat';
    const model = { provider: input.provider, model: input.model, api_key: apiKey, ...(input.baseUrl ? { base_url: input.baseUrl } : {}), ...(input.hfProvider ? { hf_provider: input.hfProvider } : {}) };
    const result = await agentJson<{ ok: boolean; tools?: boolean | null; structured?: boolean | null; dimension?: number | null; picture?: boolean | null; latency_ms: number; error?: { code: string; message: string } }>(
      '/v1/models/test',
      { kind, model, make_picture: Boolean(input.makePicture) },
      { timeoutMs: 240_000 },
    );
    await AiUsage.record('test', { error: !result.ok, pictures: result.picture ? 1 : 0 });

    // Kept with the settings only when the tested values are the saved ones
    const matchesSaved = saved.provider === input.provider && saved.model === input.model && (saved.baseUrl ?? '') === (input.baseUrl ?? '') && (saved.hfProvider ?? '') === (input.hfProvider ?? '') && (!input.apiKey || input.apiKey === readKey(saved, input.slot));
    if (matchesSaved) await AiSettings.saveTested(input.slot, { ok: result.ok, tools: result.tools ?? null, structured: result.structured ?? null, dimension: result.dimension ?? null, picture: result.picture ?? null, at: new Date().toISOString() });
    sendResponse(res, 200, result.ok ? 'Test passed' : 'Test failed', { ...result, saved: matchesSaved });
  }),
);

AiRouter.get(
  '/usage',
  admin,
  catchAsync(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    sendResponse(res, 200, 'AI usage retrieved', await AiUsage.summary(days, await AiSettings.load()));
  }),
);

// Search index

AiRouter.post(
  '/index/site-text',
  admin,
  validateRequest({ body: AiValidation.siteText }),
  catchAsync(async (req, res) => {
    await AiSettings.saveSiteText(req.body);
    AiDocuments.clearCache();
    sendResponse(res, 200, 'Site text saved');
  }),
);

// The records the assistant answers from, for checking the index and for the evaluation set in webnion_rag_agent/evals
AiRouter.get(
  '/index/documents',
  admin,
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'Documents built', await AiDocuments.build());
  }),
);

AiRouter.post(
  '/index/rebuild',
  admin,
  catchAsync(async (req, res) => {
    const result = await AiIndex.rebuild();
    if (!('skipped' in result)) await ActivityLogService.record({ ...actor(req), action: 'UPDATE', resource: 'ai', summary: 'Rebuilt the AI search index', details: `${result.documents} records, ${result.passages} passages` });
    sendResponse(res, 200, 'skipped' in result ? String(result.skipped) : 'Search index rebuilt', result);
  }),
);

AiRouter.post(
  '/index/search',
  admin,
  validateRequest({ body: AiValidation.search }),
  catchAsync(async (req, res) => {
    const value = await AiSettings.load();
    const { query, locale } = req.body as { query: string; locale: 'en' | 'bn' };
    const result = await agentJson<{ results: unknown[] }>('/v1/search', { query, locale, retrieval: await retrievalConfig(value, AiDocuments.cachedForChat) });
    sendResponse(res, 200, 'Search done', result.results);
  }),
);

const cronAllowed = (header: string | undefined) => {
  if (!config.CRON_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${config.CRON_SECRET}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

// Vercel Cron, nightly: catches any index update that was missed, and clears old per-visitor counts
AiRouter.get(
  '/index/cron',
  catchAsync(async (req, res) => {
    if (!cronAllowed(req.get('authorization'))) throw new AppError(401, 'Not allowed');
    await AiUsage.pruneVisitors();
    sendResponse(res, 200, 'Index checked', await AiIndex.sync());
  }),
);

// AI Studio

// What AI Studio can do right now, for editors too. Nothing secret.
AiRouter.get(
  '/studio/status',
  team,
  catchAsync(async (_req, res) => {
    const value = await AiSettings.load();
    sendResponse(res, 200, 'AI Studio status', {
      writing: slotReady(value, 'writing'),
      image: slotReady(value, 'image'),
      blogWriter: value.features.blogWriter,
      pictures: value.features.pictures,
      maxPictures: value.limits.picturesPerBlog,
    });
  }),
);

AiRouter.post(
  '/studio/outline',
  team,
  studioLimiter,
  validateRequest({ body: AiValidation.brief }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Outline ready', await AiStudio.outline({ brief: req.body }));
  }),
);
AiRouter.post('/studio/write', team, studioLimiter, validateRequest({ body: writeSchema }), catchAsync((req, res) => AiStudio.write(req, res)));
AiRouter.post(
  '/studio/posts/:id/picture',
  team,
  studioLimiter,
  validateRequest({ params: AiValidation.postParam, body: AiValidation.picture }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Picture added', await AiStudio.picture(req));
  }),
);
AiRouter.post('/studio/posts/:id/translate', team, studioLimiter, validateRequest({ params: AiValidation.postParam }), catchAsync((req, res) => AiStudio.translate(req, res)));
