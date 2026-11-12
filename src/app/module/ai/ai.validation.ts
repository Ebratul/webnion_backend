import { z } from 'zod';
import { slugSchema } from '../../utils/validators.js';

export const CHAT_PROVIDERS = ['openai', 'anthropic', 'google_genai', 'groq', 'mistralai', 'huggingface', 'openai_compatible', 'fake'] as const;
export const EMBEDDING_PROVIDERS = ['openai', 'google_genai', 'mistralai', 'huggingface', 'openai_compatible', 'fake'] as const;
export const IMAGE_PROVIDERS = ['openai', 'google_genai', 'huggingface', 'cloudflare', 'fake'] as const;

export const MODEL_SLOTS = ['chat', 'writing', 'image', 'embedding'] as const;
export type ModelSlot = (typeof MODEL_SLOTS)[number];

export const PROVIDERS_FOR: Record<ModelSlot, readonly string[]> = {
  chat: CHAT_PROVIDERS,
  writing: CHAT_PROVIDERS,
  image: IMAGE_PROVIDERS,
  embedding: EMBEDDING_PROVIDERS,
};

const modelName = z.string().trim().max(200).regex(/^[A-Za-z0-9._:/@+-]*$/, 'Model names use letters, numbers and . _ : / @ + -');
const price = z.number().min(0).max(10_000);

const slotInput = z.strictObject({
  provider: z.union([z.enum(CHAT_PROVIDERS), z.enum(EMBEDDING_PROVIDERS), z.enum(IMAGE_PROVIDERS), z.literal('')]).optional(),
  model: modelName.optional(),
  // A new key replaces the saved one. Leaving it out keeps the saved key.
  apiKey: z.string().trim().min(8, 'This key looks too short').max(4096).optional(),
  clearApiKey: z.boolean().optional(),
  baseUrl: z.string().trim().max(500).optional(),
  hfProvider: z.string().trim().regex(/^[a-z0-9-]{0,40}$/).optional(),
  // Cloudflare Workers AI only
  accountId: z.string().trim().toLowerCase().regex(/^([0-9a-f]{32})?$/, 'The Cloudflare account ID is 32 letters and numbers').optional(),
  pricing: z.strictObject({ inputPerMillion: price.optional(), outputPerMillion: price.optional(), perPicture: price.optional() }).optional(),
});

const localizedLine = (max: number) => z.strictObject({ en: z.string().trim().max(max), bn: z.string().trim().max(max) });
const suggestions = z.array(z.string().trim().min(1).max(80)).max(4);

export const AiValidation = {
  update: z.strictObject({
    enabled: z.boolean().optional(),
    showOnSite: z.boolean().optional(),
    showInAdmin: z.boolean().optional(),
    features: z.strictObject({ siteQa: z.boolean(), chatInquiry: z.boolean(), blogWriter: z.boolean(), pictures: z.boolean() }).partial().optional(),
    models: z.strictObject({ chat: slotInput, writing: slotInput, image: slotInput, embedding: slotInput }).partial().optional(),
    pinecone: z
      .strictObject({
        apiKey: z.string().trim().min(8).max(500).optional(),
        clearApiKey: z.boolean().optional(),
        index: z.string().trim().regex(/^[a-z0-9-]{1,45}$/, 'Use lowercase letters, numbers and hyphens').optional(),
        cloud: z.enum(['aws', 'gcp', 'azure']).optional(),
        region: z.string().trim().regex(/^[a-z0-9-]{3,30}$/).optional(),
      })
      .optional(),
    langsmith: z
      .strictObject({
        apiKey: z.string().trim().min(8).max(500).optional(),
        clearApiKey: z.boolean().optional(),
        project: z.string().trim().min(1).max(100).optional(),
      })
      .optional(),
    limits: z
      .strictObject({
        messagesPerVisitorPerDay: z.number().int().min(1).max(1000),
        publicMessagesPerDay: z.number().int().min(1).max(100_000),
        blogsPerDay: z.number().int().min(0).max(200),
        picturesPerBlog: z.number().int().min(0).max(6),
        picturesPerDay: z.number().int().min(0).max(500),
        maxReplyTokens: z.number().int().min(64).max(2000),
      })
      .partial()
      .optional(),
    assistant: z
      .strictObject({
        name: localizedLine(60),
        greeting: localizedLine(300),
        suggestions: z.strictObject({ en: suggestions, bn: suggestions }),
        tone: z.string().trim().max(400),
      })
      .partial()
      .optional(),
  }),

  test: z.strictObject({
    slot: z.enum(MODEL_SLOTS),
    // The values in the form, which may not be saved yet. A missing key means the saved one.
    provider: z.string().trim().max(40),
    model: modelName.min(1, 'Type a model name'),
    apiKey: z.string().trim().max(4096).optional(),
    baseUrl: z.string().trim().max(500).optional(),
    hfProvider: z.string().trim().regex(/^[a-z0-9-]{0,40}$/).optional(),
    accountId: z.string().trim().toLowerCase().regex(/^([0-9a-f]{32})?$/, 'The Cloudflare account ID is 32 letters and numbers').optional(),
    makePicture: z.boolean().optional(),
  }),

  chat: z.strictObject({
    locale: z.enum(['en', 'bn']).default('en'),
    messages: z
      .array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
      .min(1)
      .max(10)
      .refine((messages) => messages.at(-1)?.role === 'user', 'The last message must be yours')
      .refine((messages) => messages.at(-1)!.content.length <= 1000, 'Messages can be at most 1000 characters'),
  }),

  search: z.strictObject({ query: z.string().trim().min(1).max(300), locale: z.enum(['en', 'bn']).default('en') }),

  siteText: z.strictObject({
    // Sent by the admin panel at Rebuild: the website's built-in text, which lives in the frontend code
    en: z.array(z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), title: z.string().max(300), url: z.string().max(500), text: z.string().max(20_000) })).max(60),
    bn: z.array(z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), title: z.string().max(300), url: z.string().max(500), text: z.string().max(20_000) })).max(60),
  }),

  brief: z.strictObject({
    topic: z.string().trim().min(3, 'Give a topic').max(300),
    audience: z.string().trim().max(200).default(''),
    tone: z.string().trim().max(100).default(''),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    keywords: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    notes: z.string().trim().max(1500).default(''),
  }),

  outline: z.strictObject({
    title: z.string().trim().min(1).max(200),
    angle: z.string().trim().max(600).default(''),
    sections: z
      .array(z.strictObject({ heading: z.string().trim().min(1).max(200), points: z.array(z.string().trim().max(400)).max(8).default([]) }))
      .min(2)
      .max(10),
  }),

  postParam: z.object({ id: z.uuid() }),
  picture: z.strictObject({ index: z.number().int().min(0).max(10) }),
};

export const writeSchema = z.strictObject({
  brief: AiValidation.brief,
  outline: AiValidation.outline,
  languages: z.array(z.enum(['en', 'bn'])).min(1).max(2).default(['en']),
  maxPictures: z.number().int().min(0).max(6).optional(),
  slug: slugSchema.optional(),
});

export type AiSettingsUpdate = z.infer<typeof AiValidation.update>;
