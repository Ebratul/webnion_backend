import type { Request, Response } from 'express';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ContentBlock } from '../../interfaces/index.js';
import { agentEvents, agentFetch, agentJson, AgentError } from '../../lib/agent.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { ActivityLogService, clientIp } from '../activity-log/activity-log.service.js';
import { BlogPostService } from '../blog-post/blog-post.service.js';
import { UploadService } from '../upload/upload.service.js';
import { AiDocuments } from './ai.documents.js';
import { langsmithConfig, modelConfig, retrievalConfig, siteName } from './ai.payload.js';
import { AiSettings, slotReady, type AiSettingsValue } from './ai.settings.js';
import { AiUsage } from './ai.usage.js';

type Localized = { en?: string; bn?: string };
interface PlannedPicture {
  slot: 'cover' | number;
  prompt: string;
  alt: string;
  status: 'pending' | 'done' | 'failed';
  src?: string;
}
interface AiMeta {
  topic: string;
  writingModel: string;
  languages: string[];
  pictures: PlannedPicture[];
  generatedBy?: string;
  generatedAt: string;
}

interface Brief {
  topic: string;
  keywords?: string[];
}
const briefQuery = (brief: Brief) => [brief.topic, ...(brief.keywords ?? [])].join(' ');

const actor = (req: Request) => ({ actorId: req.user!.id, actorName: req.user!.name, actorEmail: req.user!.email, ip: clientIp(req) });

const requireWriter = (value: AiSettingsValue) => {
  if (!value.features.blogWriter) throw new AppError(403, 'The blog writer is turned off in AI Settings');
  if (!slotReady(value, 'writing')) throw new AppError(400, 'Add the writing model and its key in AI Settings first');
};

const openStream = (res: Response) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);
};

const outline = async (body: Record<string, unknown>) => {
  const value = await AiSettings.load();
  requireWriter(value);
  try {
    const result = await agentJson<{ outline: unknown }>(
      '/v1/blog/outline',
      { brief: body.brief, writing_model: modelConfig(value, 'writing'), retrieval: await retrievalConfig(value, () => AiDocuments.forQuery(briefQuery(body.brief as Brief))), site_name: await siteName(), langsmith: langsmithConfig(value) },
      { timeoutMs: 150_000 },
    );
    await AiUsage.record('outline');
    return result.outline;
  } catch (error) {
    await AiUsage.record('outline', { error: true });
    throw error;
  }
};

// Step 2: writes the article and saves it as a draft. Pictures and the Bangla version follow in their own requests.
const write = async (req: Request, res: Response) => {
  const value = await AiSettings.load();
  requireWriter(value);
  if ((await AiUsage.countToday('write')) >= value.limits.blogsPerDay) throw new AppError(429, `Today's limit of ${value.limits.blogsPerDay} blog drafts is reached. Raise it in AI Settings or try tomorrow.`);

  const { brief, outline: plan, languages, maxPictures } = req.body as { brief: { topic: string }; outline: { title: string }; languages: string[]; maxPictures?: number };
  const pictures = value.features.pictures && slotReady(value, 'image') ? Math.min(maxPictures ?? value.limits.picturesPerBlog, value.limits.picturesPerBlog) : 0;
  const send = openStream(res);
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const response = await agentFetch(
      '/v1/blog/write',
      {
        brief,
        outline: plan,
        writing_model: modelConfig(value, 'writing'),
        retrieval: await retrievalConfig(value, () => AiDocuments.forQuery(`${briefQuery(brief as Brief)} ${plan.title}`)),
        site_name: await siteName(),
        languages,
        max_pictures: pictures,
        langsmith: langsmithConfig(value),
      },
      { timeoutMs: 295_000, signal: abort.signal },
    );
    for await (const event of agentEvents(response)) {
      if (event.type === 'progress') send({ type: 'progress', message: event.message });
      else if (event.type === 'error') throw new AgentError(502, String(event.message ?? 'The writer failed'), String(event.code ?? 'error'));
      else if (event.type === 'result') {
        const post = event.post as { title: string; slug: string; excerpt: string; blocks: ContentBlock[]; seo_title: string; seo_description: string; tags: string[] };
        const meta: AiMeta = {
          topic: brief.topic,
          writingModel: `${value.models.writing.provider}/${value.models.writing.model}`,
          languages,
          pictures: ((event.pictures as Omit<PlannedPicture, 'status'>[]) ?? []).map((picture) => ({ ...picture, status: 'pending' })),
          generatedBy: req.user!.name,
          generatedAt: new Date().toISOString(),
        };
        const saved = await prisma.blogPost.create({
          data: {
            slug: await BlogPostService.freeSlug(post.slug),
            title: { en: post.title, bn: '' },
            excerpt: { en: post.excerpt, bn: '' },
            content: { en: post.blocks.length ? post.blocks : [{ type: 'paragraph', text: post.excerpt || post.title }] } as Prisma.InputJsonValue,
            tags: [...new Set(post.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].join(', ').slice(0, 400),
            seoTitle: { en: post.seo_title, bn: '' },
            seoDescription: { en: post.seo_description, bn: '' },
            status: 'DRAFT',
            authorName: req.user!.name,
            aiGenerated: true,
            aiMeta: meta as unknown as Prisma.InputJsonValue,
          },
        });
        await AiUsage.record('write');
        await ActivityLogService.record({ ...actor(req), action: 'CREATE', resource: 'blog-posts', resourceId: saved.id, summary: `Wrote a blog draft with AI: "${post.title}"`, details: `Model: ${meta.writingModel}` });
        send({ type: 'saved', id: saved.id, slug: saved.slug, title: post.title, pictures: meta.pictures.length, translate: languages.includes('bn') });
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      await AiUsage.record('write', { error: true });
      send({ type: 'error', message: error instanceof AppError ? error.message : 'The writer failed. Please try again.' });
    }
  }
  send({ type: 'done' });
  res.end();
};

// Puts a picture after the paragraph that follows a section heading, or replaces the picture made before it
const placePicture = (blocks: ContentBlock[], slot: number, image: ContentBlock & { type: 'image' }, previous?: string) => {
  if (previous) {
    const index = blocks.findIndex((block) => block.type === 'image' && block.src === previous);
    if (index >= 0) return blocks.map((block, position) => (position === index ? image : block));
  }
  let heading = -1;
  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index]!.type !== 'heading') continue;
    heading += 1;
    if (heading === slot) {
      const at = blocks[index + 1]?.type === 'paragraph' ? index + 2 : index + 1;
      return [...blocks.slice(0, at), image, ...blocks.slice(at)];
    }
  }
  return [...blocks, image];
};

const picture = async (req: Request) => {
  const value = await AiSettings.load();
  if (!value.features.pictures) throw new AppError(403, 'Picture generation is turned off in AI Settings');
  if (!slotReady(value, 'image')) throw new AppError(400, 'Add the picture model and its key in AI Settings first');
  if ((await AiUsage.countToday('picture', 'pictures')) >= value.limits.picturesPerDay) throw new AppError(429, `Today's limit of ${value.limits.picturesPerDay} pictures is reached.`);

  const post = await BlogPostService.getById(req.params.id as string);
  const meta = post.aiMeta as unknown as AiMeta | null;
  const index = (req.body as { index: number }).index;
  const planned = meta?.pictures?.[index];
  if (!meta || !planned) throw new AppError(404, 'This picture is not in the plan');

  let stored: { path: string };
  try {
    const result = await agentJson<{ data: string; mime: string }>('/v1/images', { image_model: modelConfig(value, 'image'), prompt: planned.prompt, aspect: 'landscape', langsmith: langsmithConfig(value) }, { timeoutMs: 280_000 });
    stored = await UploadService.storeBuffer(Buffer.from(result.data, 'base64'));
    await AiUsage.record('picture', { pictures: 1 });
  } catch (error) {
    await AiUsage.record('picture', { error: true });
    meta.pictures[index] = { ...planned, status: 'failed' };
    await prisma.blogPost.update({ where: { id: post.id }, data: { aiMeta: meta as unknown as Prisma.InputJsonValue } });
    throw error;
  }

  const data: Prisma.BlogPostUpdateInput = {};
  if (planned.slot === 'cover') {
    data.cover = stored.path;
    data.coverAlt = { en: planned.alt, bn: (post.coverAlt as Localized | null)?.bn ?? '' };
  } else {
    const content = post.content as { en: ContentBlock[]; bn?: ContentBlock[] };
    const image = { type: 'image' as const, src: stored.path, alt: planned.alt };
    data.content = {
      en: placePicture(content.en, planned.slot, image, planned.src),
      ...(content.bn?.length ? { bn: placePicture(content.bn, planned.slot, image, planned.src) } : {}),
    } as Prisma.InputJsonValue;
  }
  meta.pictures[index] = { ...planned, status: 'done', src: stored.path };
  data.aiMeta = meta as unknown as Prisma.InputJsonValue;
  return prisma.blogPost.update({ where: { id: post.id }, data });
};

const translate = async (req: Request, res: Response) => {
  const value = await AiSettings.load();
  requireWriter(value);
  const post = await BlogPostService.getById(req.params.id as string);
  const pick = (field: unknown) => (field as Localized | null)?.en ?? '';
  const content = post.content as { en: ContentBlock[] };
  const send = openStream(res);
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const response = await agentFetch(
      '/v1/blog/translate',
      {
        writing_model: modelConfig(value, 'writing'),
        post: { title: pick(post.title), excerpt: pick(post.excerpt), blocks: content.en, seo_title: pick(post.seoTitle), seo_description: pick(post.seoDescription), tags: [] },
        langsmith: langsmithConfig(value),
      },
      { timeoutMs: 295_000, signal: abort.signal },
    );
    for await (const event of agentEvents(response)) {
      if (event.type === 'progress') send({ type: 'progress', message: event.message });
      else if (event.type === 'error') throw new AgentError(502, String(event.message ?? 'The translation failed'), String(event.code ?? 'error'));
      else if (event.type === 'result') {
        const result = event.post as { title: string; excerpt: string; blocks: ContentBlock[]; seo_title: string; seo_description: string };
        const withBangla = (field: unknown, bn: string) => ({ en: pick(field), bn });
        await prisma.blogPost.update({
          where: { id: post.id },
          data: {
            title: withBangla(post.title, result.title),
            excerpt: withBangla(post.excerpt, result.excerpt),
            seoTitle: withBangla(post.seoTitle, result.seo_title),
            seoDescription: withBangla(post.seoDescription, result.seo_description),
            content: { en: content.en, bn: result.blocks } as Prisma.InputJsonValue,
          },
        });
        await AiUsage.record('translate');
        await ActivityLogService.record({ ...actor(req), action: 'UPDATE', resource: 'blog-posts', resourceId: post.id, summary: `Translated "${pick(post.title)}" into Bangla with AI` });
        send({ type: 'saved', id: post.id });
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      await AiUsage.record('translate', { error: true });
      send({ type: 'error', message: error instanceof AppError ? error.message : 'The translation failed. Please try again.' });
    }
  }
  send({ type: 'done' });
  res.end();
};

export const AiStudio = { outline, write, picture, translate };
