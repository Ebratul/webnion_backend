import { z } from 'zod';

export const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(2000),
  bn: z.string().trim().min(1).max(2000),
});

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const httpUrlSchema = z.string().trim().max(2048).refine(isHttpUrl, 'Must be an http or https URL');

// Accepts a path inside the frontend's public folder or a full URL
export const assetSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^\/(?!\/)/.test(value) || isHttpUrl(value), 'Must be a site path or an http(s) URL');

export const sortFields = {
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
};

export const idParamSchema = z.object({ id: z.uuid() });
