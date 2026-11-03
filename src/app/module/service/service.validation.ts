import { z } from 'zod';
import { assetSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createService = z.strictObject({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title: localizedTextSchema,
  description: localizedTextSchema,
  image: assetSchema,
  ...sortFields,
});

export const ServiceValidation = {
  create: createService,
  update: createService.partial(),
};
