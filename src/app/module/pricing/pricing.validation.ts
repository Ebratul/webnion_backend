import { z } from 'zod';
import { localizedTextSchema, nullableJson, sortFields } from '../../utils/validators.js';

const createPricing = z.strictObject({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  name: localizedTextSchema,
  tagline: localizedTextSchema,
  badge: nullableJson(localizedTextSchema),
  price: z.number().int().min(0),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  features: z.array(localizedTextSchema).min(1).max(30),
  isFeatured: z.boolean().optional(),
  ...sortFields,
});

export const PricingValidation = {
  create: createPricing,
  update: createPricing.partial(),
};
