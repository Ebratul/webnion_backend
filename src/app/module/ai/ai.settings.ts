import type { Prisma } from '../../../generated/prisma/client.js';
import { config } from '../../config/index.js';
import type { Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { checkPublicUrl } from '../../lib/safeUrl.js';
import { canEncrypt, decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { AppError } from '../../utils/AppError.js';
import { MODEL_SLOTS, PROVIDERS_FOR, type AiSettingsUpdate, type ModelSlot } from './ai.validation.js';

export interface Tested {
  ok: boolean;
  tools?: boolean | null;
  structured?: boolean | null;
  dimension?: number | null;
  picture?: boolean | null;
  at: string;
}

export interface StoredSlot {
  provider: string;
  model: string;
  apiKey?: string;
  keyLast4?: string;
  baseUrl?: string;
  hfProvider?: string;
  accountId?: string;
  pricing?: { inputPerMillion?: number; outputPerMillion?: number; perPicture?: number };
  tested?: Tested;
}

interface StoredKeyed {
  apiKey?: string;
  keyLast4?: string;
}

export interface AiSettingsValue {
  enabled: boolean;
  showOnSite: boolean;
  showInAdmin: boolean;
  features: { siteQa: boolean; chatInquiry: boolean; blogWriter: boolean; pictures: boolean };
  models: Record<ModelSlot, StoredSlot>;
  pinecone: StoredKeyed & { index: string; cloud: 'aws' | 'gcp' | 'azure'; region: string };
  langsmith: StoredKeyed & { project: string };
  limits: { messagesPerVisitorPerDay: number; publicMessagesPerDay: number; blogsPerDay: number; picturesPerBlog: number; picturesPerDay: number; maxReplyTokens: number };
  assistant: { name: Record<Locale, string>; greeting: Record<Locale, string>; suggestions: Record<Locale, string[]>; tone: string };
  index: { signature?: string; dimension?: number; documents?: number; passages?: number; lastSyncAt?: string; lastRebuildAt?: string; lastError?: string };
}

const emptySlot = (): StoredSlot => ({ provider: '', model: '' });

export const DEFAULT_SETTINGS: AiSettingsValue = {
  enabled: false,
  showOnSite: true,
  showInAdmin: true,
  features: { siteQa: true, chatInquiry: true, blogWriter: true, pictures: true },
  models: { chat: emptySlot(), writing: emptySlot(), image: emptySlot(), embedding: emptySlot() },
  pinecone: { index: 'webnion', cloud: 'aws', region: 'us-east-1' },
  langsmith: { project: 'webnion' },
  limits: { messagesPerVisitorPerDay: 30, publicMessagesPerDay: 1000, blogsPerDay: 10, picturesPerBlog: 3, picturesPerDay: 30, maxReplyTokens: 600 },
  assistant: {
    name: { en: 'Webnion Assistant', bn: 'ওয়েবনিয়ন অ্যাসিস্ট্যান্ট' },
    greeting: {
      en: "Hi! Ask me about our services, prices or past projects. I can also pass your project details to the team.",
      bn: 'হ্যালো! আমাদের সার্ভিস, দাম বা আগের প্রজেক্ট নিয়ে জিজ্ঞেস করুন। চাইলে আপনার প্রজেক্টের তথ্য টিমের কাছে পৌঁছে দিতে পারি।',
    },
    suggestions: {
      en: ['What services do you offer?', 'How much does a website cost?', 'Can you build a mobile app?'],
      bn: ['আপনারা কী কী সার্ভিস দেন?', 'একটি ওয়েবসাইট বানাতে কত খরচ?', 'মোবাইল অ্যাপ বানাতে পারেন?'],
    },
    tone: 'Friendly, clear and professional. Short sentences.',
  },
  index: {},
};

const ROW_ID = 'main';

const merge = (stored: Partial<AiSettingsValue> | null): AiSettingsValue => {
  const value = stored ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    features: { ...DEFAULT_SETTINGS.features, ...value.features },
    models: Object.fromEntries(MODEL_SLOTS.map((slot) => [slot, { ...emptySlot(), ...value.models?.[slot] }])) as Record<ModelSlot, StoredSlot>,
    pinecone: { ...DEFAULT_SETTINGS.pinecone, ...value.pinecone },
    langsmith: { ...DEFAULT_SETTINGS.langsmith, ...value.langsmith },
    limits: { ...DEFAULT_SETTINGS.limits, ...value.limits },
    assistant: {
      name: { ...DEFAULT_SETTINGS.assistant.name, ...value.assistant?.name },
      greeting: { ...DEFAULT_SETTINGS.assistant.greeting, ...value.assistant?.greeting },
      suggestions: { ...DEFAULT_SETTINGS.assistant.suggestions, ...value.assistant?.suggestions },
      tone: value.assistant?.tone ?? DEFAULT_SETTINGS.assistant.tone,
    },
    index: { ...value.index },
  };
};

const load = async (): Promise<AiSettingsValue> => {
  const row = await prisma.aiSetting.findUnique({ where: { id: ROW_ID } });
  return merge(row?.value as Partial<AiSettingsValue> | null);
};

const save = async (value: AiSettingsValue) => {
  await prisma.aiSetting.upsert({ where: { id: ROW_ID }, update: { value: value as unknown as Prisma.InputJsonValue }, create: { id: ROW_ID, value: value as unknown as Prisma.InputJsonValue } });
  return value;
};

// Slot names double as the encryption's bound data, so a key saved for one job cannot be moved to another
const keySlot = (name: string) => `ai:${name}`;

export const readKey = (holder: StoredKeyed, name: string) => decryptSecret(holder.apiKey, keySlot(name));

const hasKey = (holder: StoredKeyed, name: string) => Boolean(readKey(holder, name));

// What the browser sees: never a key, only whether one is saved and its last four characters
const maskKeyed = <T extends StoredKeyed>(holder: T, name: string) => {
  const { apiKey, keyLast4, ...rest } = holder;
  const stored = Boolean(apiKey);
  const readable = stored && hasKey(holder, name);
  return { ...rest, hasKey: readable, keyHint: readable && keyLast4 ? `••••${keyLast4}` : '', keyUnreadable: stored && !readable };
};

const masked = (value: AiSettingsValue) => ({
  ...value,
  models: Object.fromEntries(MODEL_SLOTS.map((slot) => [slot, maskKeyed(value.models[slot], slot)])),
  pinecone: maskKeyed(value.pinecone, 'pinecone'),
  langsmith: maskKeyed(value.langsmith, 'langsmith'),
});

export const slotReady = (value: AiSettingsValue, slot: ModelSlot) => {
  const model = value.models[slot];
  if (!model.provider || !model.model) return false;
  if (model.provider === 'fake') return config.allowFakeAi;
  return hasKey(model, slot);
};

export const indexReady = (value: AiSettingsValue) => slotReady(value, 'embedding') && hasKey(value.pinecone, 'pinecone');

// Which embedding model and index the search index was built with. A change means a rebuild.
export const indexSignature = (value: AiSettingsValue) => {
  const { provider, model, baseUrl = '' } = value.models.embedding;
  return [provider, model, baseUrl, value.pinecone.index].join('|');
};

const applyKey = (holder: StoredKeyed, name: string, input: { apiKey?: string; clearApiKey?: boolean }, changes: string[], label: string) => {
  if (input.clearApiKey) {
    if (holder.apiKey) changes.push(`removed the ${label} key`);
    delete holder.apiKey;
    delete holder.keyLast4;
  }
  if (input.apiKey) {
    if (!canEncrypt()) throw new AppError(503, 'AI_SECRETS_KEY is not set on the server, so keys cannot be saved');
    holder.apiKey = encryptSecret(input.apiKey, keySlot(name));
    holder.keyLast4 = input.apiKey.slice(-4);
    changes.push(`changed the ${label} key`);
  }
};

const SLOT_LABELS: Record<ModelSlot, string> = { chat: 'chat model', writing: 'writing model', image: 'picture model', embedding: 'embedding model' };

// Cloudflare model names go into the request address, so only the documented shape is accepted
const CLOUDFLARE_MODEL = /^@(cf|hf)\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export const checkProvider = async (slot: ModelSlot, provider: string, baseUrl: string | undefined, extra: { model?: string; accountId?: string } = {}) => {
  if (!provider) return;
  if (provider === 'cloudflare') {
    if (!extra.accountId) throw new AppError(400, 'Add the Cloudflare account ID for the picture model');
    if (extra.model && (!CLOUDFLARE_MODEL.test(extra.model) || extra.model.includes('..'))) throw new AppError(400, 'Cloudflare model names look like @cf/black-forest-labs/flux-1-schnell');
  }
  if (!PROVIDERS_FOR[slot].includes(provider)) throw new AppError(400, `${provider} cannot be used as the ${SLOT_LABELS[slot]}`);
  if (provider === 'fake' && !config.allowFakeAi) throw new AppError(400, 'The fake provider is only for local testing');
  if (provider === 'openai_compatible' && !baseUrl) throw new AppError(400, `Add the base address for the ${SLOT_LABELS[slot]}`);
  if (baseUrl) {
    const problem = await checkPublicUrl(baseUrl);
    if (problem) throw new AppError(400, `${SLOT_LABELS[slot]}: ${problem}`);
  }
};

const update = async (input: AiSettingsUpdate) => {
  const value = await load();
  const changes: string[] = [];

  for (const key of ['enabled', 'showOnSite', 'showInAdmin'] as const) {
    if (input[key] !== undefined && input[key] !== value[key]) {
      value[key] = input[key];
      changes.push(`${key === 'enabled' ? 'turned the assistant' : key === 'showOnSite' ? 'set it on the website' : 'set it in the admin panel'} ${input[key] ? 'on' : 'off'}`);
    }
  }
  if (input.features) {
    value.features = { ...value.features, ...input.features };
    changes.push('features');
  }

  for (const slot of MODEL_SLOTS) {
    const slotInput = input.models?.[slot];
    if (!slotInput) continue;
    const current = value.models[slot];
    const next: StoredSlot = {
      ...current,
      provider: slotInput.provider ?? current.provider,
      model: slotInput.model ?? current.model,
      baseUrl: slotInput.baseUrl ?? current.baseUrl,
      hfProvider: slotInput.hfProvider ?? current.hfProvider,
      accountId: slotInput.accountId ?? current.accountId,
      pricing: slotInput.pricing ? { ...current.pricing, ...slotInput.pricing } : current.pricing,
    };
    if (!next.baseUrl) delete next.baseUrl;
    if (!next.hfProvider) delete next.hfProvider;
    if (!next.accountId || next.provider !== 'cloudflare') delete next.accountId;
    await checkProvider(slot, next.provider, next.baseUrl, { model: next.model, accountId: next.accountId });
    applyKey(next, slot, slotInput, changes, SLOT_LABELS[slot]);

    // A different model or key has not been tested yet
    const changedModel = next.provider !== current.provider || next.model !== current.model || next.baseUrl !== current.baseUrl || next.hfProvider !== current.hfProvider || next.accountId !== current.accountId;
    if (changedModel || slotInput.apiKey || slotInput.clearApiKey) delete next.tested;
    if (changedModel) changes.push(`set the ${SLOT_LABELS[slot]} to ${next.provider || 'none'} ${next.model}`.trim());
    value.models[slot] = next;
  }

  if (input.pinecone) {
    const { apiKey, clearApiKey, ...rest } = input.pinecone;
    value.pinecone = { ...value.pinecone, ...rest };
    applyKey(value.pinecone, 'pinecone', { apiKey, clearApiKey }, changes, 'Pinecone');
    if (Object.keys(rest).length) changes.push('Pinecone index');
  }
  if (input.langsmith) {
    const { apiKey, clearApiKey, ...rest } = input.langsmith;
    value.langsmith = { ...value.langsmith, ...rest };
    applyKey(value.langsmith, 'langsmith', { apiKey, clearApiKey }, changes, 'LangSmith');
  }
  if (input.limits) {
    value.limits = { ...value.limits, ...input.limits };
    changes.push('limits');
  }
  if (input.assistant) {
    value.assistant = { ...value.assistant, ...input.assistant };
    changes.push('greeting and tone');
  }

  await save(value);
  return { settings: masked(value), changes };
};

const saveTested = async (slot: ModelSlot, tested: Tested) => {
  const value = await load();
  value.models[slot].tested = tested;
  await save(value);
};

const saveIndex = async (index: Partial<AiSettingsValue['index']>) => {
  const value = await load();
  value.index = { ...value.index, ...index };
  await save(value);
};

const status = (value: AiSettingsValue) => ({
  agentConnected: Boolean(config.agent),
  canSaveKeys: canEncrypt(),
  fakeAllowed: config.allowFakeAi,
  ready: Object.fromEntries(MODEL_SLOTS.map((slot) => [slot, slotReady(value, slot)])),
  indexReady: indexReady(value),
  needsRebuild: indexReady(value) && value.index.signature !== indexSignature(value),
});

const getForAdmin = async () => {
  const value = await load();
  return { settings: masked(value), status: status(value) };
};

// Snapshot of the website's built-in text, sent by the admin panel, so the nightly index check can include it
const SITE_TEXT_ID = 'site-text';
export interface SiteTextDocument {
  id: string;
  title: string;
  url: string;
  text: string;
}

const loadSiteText = async (): Promise<Record<Locale, SiteTextDocument[]>> => {
  const row = await prisma.aiSetting.findUnique({ where: { id: SITE_TEXT_ID } });
  return (row?.value as Record<Locale, SiteTextDocument[]> | undefined) ?? { en: [], bn: [] };
};

const saveSiteText = async (value: Record<Locale, SiteTextDocument[]>) => {
  const json = value as unknown as Prisma.InputJsonValue;
  await prisma.aiSetting.upsert({ where: { id: SITE_TEXT_ID }, update: { value: json }, create: { id: SITE_TEXT_ID, value: json } });
};

export const AiSettings = { load, update, getForAdmin, saveTested, saveIndex, status, masked, loadSiteText, saveSiteText };
