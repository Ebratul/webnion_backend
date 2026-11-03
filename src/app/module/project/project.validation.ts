import { z } from 'zod';
import { assetSchema, httpUrlSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createProject = z.strictObject({
  name: z.string().trim().min(1).max(120),
  category: localizedTextSchema,
  image: assetSchema,
  url: httpUrlSchema.nullable().optional(),
  isFeatured: z.boolean().default(false),
  ...sortFields,
});

export const ProjectValidation = {
  create: createProject,
  update: createProject.partial(),
};
