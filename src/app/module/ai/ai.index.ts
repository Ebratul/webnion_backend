import { agentJson } from '../../lib/agent.js';
import { prisma } from '../../lib/prisma.js';
import { AiDocuments, documentHash, documentKey, type AiDocument } from './ai.documents.js';
import { modelConfig, pineconeConfig } from './ai.payload.js';
import { AiSettings, indexReady, indexSignature } from './ai.settings.js';
import { AiUsage } from './ai.usage.js';

// The AI service takes up to 600 records per request. Smaller batches also keep each call well inside Vercel's time limit.
const BATCH = 150;

interface UpsertResult {
  documents: number;
  passages: number;
  dimension: number;
}

const upsert = async (documents: AiDocument[], replaceAll: boolean) => {
  const value = await AiSettings.load();
  let passages = 0;
  let dimension = 0;
  for (let start = 0; start < Math.max(documents.length, 1); start += BATCH) {
    const result = await agentJson<UpsertResult>(
      '/v1/index/upsert',
      { embedding: modelConfig(value, 'embedding'), pinecone: pineconeConfig(value), documents: documents.slice(start, start + BATCH), replace_all: replaceAll && start === 0 },
      { timeoutMs: 280_000 },
    );
    passages += result.passages;
    dimension = result.dimension;
  }
  return { passages, dimension };
};

// Empties the index and writes every record again. Needed after changing the embedding model.
const rebuild = async () => {
  const value = await AiSettings.load();
  if (!indexReady(value)) return { skipped: 'Add the embedding model and the Pinecone key first' };
  const documents = await AiDocuments.build();
  try {
    const { passages, dimension } = await upsert(documents, true);
    await prisma.$transaction([prisma.aiIndexEntry.deleteMany(), prisma.aiIndexEntry.createMany({ data: documents.map((document) => ({ key: documentKey(document), hash: documentHash(document) })) })]);
    const now = new Date().toISOString();
    await AiSettings.saveIndex({ signature: indexSignature(value), dimension, documents: documents.length, passages, lastRebuildAt: now, lastSyncAt: now, lastError: '' });
    await AiUsage.record('index');
    return { documents: documents.length, passages, dimension };
  } catch (error) {
    await AiSettings.saveIndex({ lastError: (error as Error).message.slice(0, 300) });
    await AiUsage.record('index', { error: true });
    throw error;
  }
};

// Sends only the records that changed since the last sync, and removes the ones that are gone
const sync = async () => {
  const value = await AiSettings.load();
  if (!indexReady(value) || value.index.signature !== indexSignature(value)) return { skipped: true };

  const [documents, entries] = await Promise.all([AiDocuments.build(), prisma.aiIndexEntry.findMany()]);
  const known = new Map(entries.map((entry) => [entry.key, entry.hash]));
  const current = new Map(documents.map((document) => [documentKey(document), document]));

  const removedKeys = entries.map((entry) => entry.key).filter((key) => !current.has(key));
  // Deleting removes every language of a record, so a language that still exists is sent again
  const removedRecords = new Set(removedKeys.map((key) => key.split(':').slice(0, 2).join(':')));
  const changed = documents.filter((document) => known.get(documentKey(document)) !== documentHash(document) || removedRecords.has(`${document.type}:${document.id}`));

  if (removedRecords.size) {
    const items = [...removedRecords].map((record) => {
      const [type, id] = record.split(':');
      return { type, id };
    });
    for (let start = 0; start < items.length; start += 200) {
      await agentJson('/v1/index/delete', { pinecone: pineconeConfig(value), items: items.slice(start, start + 200) }, { timeoutMs: 120_000 });
    }
    await prisma.aiIndexEntry.deleteMany({ where: { key: { in: removedKeys } } });
  }
  if (changed.length) {
    await upsert(changed, false);
    for (const document of changed) {
      const key = documentKey(document);
      await prisma.aiIndexEntry.upsert({ where: { key }, update: { hash: documentHash(document) }, create: { key, hash: documentHash(document) } });
    }
  }
  if (changed.length || removedRecords.size) await AiUsage.record('index');
  await AiSettings.saveIndex({ lastSyncAt: new Date().toISOString(), documents: documents.length, lastError: '' });
  return { updated: changed.length, removed: removedRecords.size };
};

// Content edits come in bursts (a reorder is many saves), so one copy of the API runs at most one sync at a time
let running: Promise<unknown> | null = null;
let again = false;

const syncSoon = (): Promise<unknown> => {
  if (running) {
    again = true;
    return running;
  }
  running = sync()
    .catch((error) => {
      console.error('Search index update failed', (error as Error).message);
      return AiSettings.saveIndex({ lastError: (error as Error).message.slice(0, 300) }).catch(() => undefined);
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void syncSoon();
      }
    });
  return running;
};

export const AiIndex = { rebuild, sync, syncSoon };
