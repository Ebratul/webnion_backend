import { z } from 'zod';
import { assetSchema, httpUrlSchema, sortFields } from '../../utils/validators.js';

const createClient = z.strictObject({
  name: z.string().trim().min(1).max(120),
  logo: assetSchema,
  url: httpUrlSchema.nullable().optional(),
  ...sortFields,
});

export const ClientValidation = {
  create: createClient,
  update: createClient.partial(),
};
