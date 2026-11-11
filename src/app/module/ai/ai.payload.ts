import { SiteSettingService } from '../site-setting/site-setting.service.js';
import type { AiDocument } from './ai.documents.js';
import { indexReady, indexSignature, readKey, type AiSettingsValue } from './ai.settings.js';
import type { ModelSlot } from './ai.validation.js';

// The settings the AI service needs for one job, with the key decrypted. Built per request and never stored or logged.
export const modelConfig = (value: AiSettingsValue, slot: ModelSlot) => {
  const stored = value.models[slot];
  return {
    provider: stored.provider,
    model: stored.model,
    api_key: readKey(stored, slot) ?? '',
    ...(stored.baseUrl ? { base_url: stored.baseUrl } : {}),
    ...(stored.hfProvider ? { hf_provider: stored.hfProvider } : {}),
    // Until Test says otherwise, the model is assumed to support both
    ...(slot === 'chat' || slot === 'writing' ? { tools: stored.tested?.tools ?? true, structured: stored.tested?.structured ?? true } : {}),
  };
};

export const pineconeConfig = (value: AiSettingsValue) => ({
  api_key: readKey(value.pinecone, 'pinecone') ?? '',
  index: value.pinecone.index,
  cloud: value.pinecone.cloud,
  region: value.pinecone.region,
});

export const langsmithConfig = (value: AiSettingsValue) => {
  const key = readKey(value.langsmith, 'langsmith');
  return key ? { api_key: key, project: value.langsmith.project } : null;
};

// Pinecone once the index is built with the current embedding model, otherwise the records themselves for keyword search
export const usesPinecone = (value: AiSettingsValue) => indexReady(value) && value.index.signature === indexSignature(value);

export const retrievalConfig = (value: AiSettingsValue, documents: () => Promise<AiDocument[]>) =>
  usesPinecone(value) ? Promise.resolve({ embedding: modelConfig(value, 'embedding'), pinecone: pineconeConfig(value) }) : documents().then((items) => ({ documents: items }));

export const siteName = async () => String((await SiteSettingService.get().catch(() => null))?.brand?.siteName || 'Webnion').slice(0, 60);
