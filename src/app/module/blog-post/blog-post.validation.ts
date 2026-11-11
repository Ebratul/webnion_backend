import { z } from 'zod';
import { assetSchema, contentBlocksSchema, nullableJson, slugSchema } from '../../utils/validators.js';

// Bangla may be added later, so only English is required
const localized = (max: number) => z.strictObject({ en: z.string().trim().min(1).max(max), bn: z.string().trim().max(max).default('') });
const optionalLocalized = (max: number) => z.strictObject({ en: z.string().trim().max(max), bn: z.string().trim().max(max).default('') });

const content = z.strictObject({ en: contentBlocksSchema, bn: z.union([contentBlocksSchema, z.array(z.unknown()).length(0)]).optional() });

const createPost = z.strictObject({
  title: localized(200),
  slug: slugSchema,
  excerpt: nullableJson(optionalLocalized(400)),
  content,
  cover: assetSchema.nullable().optional(),
  coverAlt: nullableJson(optionalLocalized(300)),
  tags: z
    .string()
    .trim()
    .max(400)
    .transform((value) => [...new Map(value.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()].join(', '))
    .nullable()
    .optional(),
  seoTitle: nullableJson(optionalLocalized(200)),
  seoDescription: nullableJson(optionalLocalized(400)),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  authorName: z.string().trim().max(120).nullable().optional(),
});

export const BlogPostValidation = {
  create: createPost,
  update: createPost.partial(),
  list: z.object({ tag: z.string().trim().max(60).optional(), locale: z.enum(['en', 'bn']).optional() }),
};
