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
    ...(stored.accountId ? { account_id: stored.accountId } : {}),
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

// A rough colour name for the brand colour: picture models follow "violet" far better than "#8224e3"
const colourName = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 'violet';
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(match[1]!.slice(start, start + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.12) return max > 0.7 ? 'soft grey' : 'charcoal';
  const hue = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  // One name for each 30 degrees of hue, starting at red
  const names = ['red', 'orange', 'golden yellow', 'lime green', 'green', 'emerald green', 'cyan', 'azure blue', 'blue', 'violet', 'magenta', 'rose pink'];
  return names[Math.floor((hue * 60 + 15) / 30) % 12]!;
};

// The house style for blog pictures: the admin's own, or a premium editorial look in the brand colour
export const pictureStyle = async (value: AiSettingsValue) => {
  if (value.studio.pictureStyle) return value.studio.pictureStyle.slice(0, 600);
  const colour = colourName(String((await SiteSettingService.get().catch(() => null))?.brand?.primaryColor ?? '#8224e3'));
  return `Modern editorial photography for a premium business magazine: soft natural window light, shallow depth of field, calm and uncluttered settings, warm neutral tones with subtle ${colour} accents that echo the brand colour.`;
};
