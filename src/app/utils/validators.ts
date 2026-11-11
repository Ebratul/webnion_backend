import { z, type ZodType } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';

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

// No zod defaults here or on other fields: inside .partial() they would overwrite stored values on every PATCH.
// A field left out on create gets its default from the database instead.
export const sortFields = {
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
};

// Prisma needs DbNull rather than null to clear a Json column
export const nullableJson = <T extends ZodType>(schema: T) =>
  schema
    .nullable()
    .optional()
    .transform((value) => (value === null ? Prisma.DbNull : value));

export const idParamSchema = z.object({ id: z.uuid() });

export const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens');

export const slugParamSchema = z.object({ slug: slugSchema });

const blockText = z.string().trim().min(1).max(5000);

export const contentBlocksSchema = z
  .array(
    z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('heading'), text: blockText }),
      z.strictObject({ type: z.literal('paragraph'), text: blockText }),
      z.strictObject({ type: z.literal('list'), items: z.array(blockText).min(1) }),
      z.strictObject({ type: z.literal('image'), src: assetSchema, alt: z.string().trim().max(300).optional() }),
    ]),
  )
  .min(1);

export const localizedContentSchema = z.strictObject({
  en: contentBlocksSchema,
  bn: contentBlocksSchema.optional(),
});
