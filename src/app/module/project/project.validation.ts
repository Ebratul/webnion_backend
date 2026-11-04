import { z } from 'zod';
import { assetSchema, httpUrlSchema, localizedContentSchema, localizedTextSchema, nullableJson, slugSchema, sortFields } from '../../utils/validators.js';

const createProject = z.strictObject({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  category: localizedTextSchema,
  image: assetSchema,
  url: httpUrlSchema.nullable().optional(),
  client: z.string().trim().min(1).max(120).nullable().optional(),
  budget: nullableJson(localizedTextSchema),
  location: nullableJson(localizedTextSchema),
  sector: nullableJson(localizedTextSchema),
  completedAt: z.coerce.date().nullable().optional(),
  content: nullableJson(localizedContentSchema),
  isFeatured: z.boolean().optional(),
  ...sortFields,
});

export const ProjectValidation = {
  create: createProject,
  update: createProject.partial(),
};
