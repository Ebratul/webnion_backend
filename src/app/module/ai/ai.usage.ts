import { createHmac } from 'node:crypto';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import type { AiSettingsValue } from './ai.settings.js';

export type AiFeature = 'chat' | 'chat-admin' | 'outline' | 'write' | 'translate' | 'picture' | 'index' | 'test';

// Usage is counted per UTC day
export const today = () => new Date(new Date().toISOString().slice(0, 10));

const record = async (feature: AiFeature, { inputTokens = 0, outputTokens = 0, pictures = 0, error = false }: { inputTokens?: number; outputTokens?: number; pictures?: number; error?: boolean } = {}) => {
  const day = today();
  const increments = { requests: 1, inputTokens, outputTokens, pictures, errors: error ? 1 : 0 };
  await prisma.aiUsage
    .upsert({
      where: { day_feature: { day, feature } },
      update: Object.fromEntries(Object.entries(increments).map(([key, value]) => [key, { increment: value }])),
      create: { day, feature, ...increments },
    })
    .catch((failure) => console.error('Could not record AI usage', failure));
};

const countToday = async (feature: AiFeature, field: 'requests' | 'pictures' = 'requests') => {
  const row = await prisma.aiUsage.findUnique({ where: { day_feature: { day: today(), feature } } });
  return row?.[field] ?? 0;
};

// A keyed hash, so the table never holds an IP address and the hash cannot be reversed without the server's secret
const visitorId = (ip: string | undefined) => createHmac('sha256', config.JWT_SECRET).update(`ai-visitor:${ip ?? 'unknown'}`).digest('hex');

// Counts the message first, then checks, so two quick requests cannot both slip under the limit
const takeVisitorMessage = async (ip: string | undefined, limit: number) => {
  const day = today();
  const visitor = visitorId(ip);
  const row = await prisma.aiVisitorUsage.upsert({
    where: { day_visitor: { day, visitor } },
    update: { messages: { increment: 1 } },
    create: { day, visitor, messages: 1 },
  });
  return row.messages <= limit;
};

// Old per-visitor rows are useless after their day, so they are removed by the nightly job
const pruneVisitors = () => prisma.aiVisitorUsage.deleteMany({ where: { day: { lt: today() } } });

const summary = async (days: number, settings: AiSettingsValue) => {
  const since = new Date(today().getTime() - (days - 1) * 86_400_000);
  const rows = await prisma.aiUsage.findMany({ where: { day: { gte: since } }, orderBy: [{ day: 'desc' }, { feature: 'asc' }] });
  const priceFor = (feature: string) => {
    const slot = feature === 'chat' || feature === 'chat-admin' ? settings.models.chat : feature === 'picture' ? settings.models.image : feature === 'index' ? settings.models.embedding : settings.models.writing;
    return slot.pricing ?? {};
  };
  return rows.map((row) => {
    const price = priceFor(row.feature);
    const cost = (row.inputTokens / 1e6) * (price.inputPerMillion ?? 0) + (row.outputTokens / 1e6) * (price.outputPerMillion ?? 0) + row.pictures * (price.perPicture ?? 0);
    return { day: row.day.toISOString().slice(0, 10), feature: row.feature, requests: row.requests, inputTokens: row.inputTokens, outputTokens: row.outputTokens, pictures: row.pictures, errors: row.errors, estimatedCost: Math.round(cost * 10_000) / 10_000 };
  });
};

export const AiUsage = { record, countToday, takeVisitorMessage, pruneVisitors, summary };
