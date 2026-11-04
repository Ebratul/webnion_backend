import { z } from 'zod';
import { assetSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createTestimonial = z.strictObject({
  kind: z.enum(['VIDEO', 'RESULT']),
  name: z.string().trim().min(1).max(120),
  role: localizedTextSchema,
  avatar: assetSchema.nullable().optional(),
  image: assetSchema,
  videoUrl: assetSchema.nullable().optional(),
  ...sortFields,
});

export const TestimonialValidation = {
  create: createTestimonial,
  update: createTestimonial.partial(),
};
