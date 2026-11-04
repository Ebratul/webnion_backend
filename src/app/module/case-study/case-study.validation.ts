import { z } from 'zod';
import { assetSchema, localizedContentSchema, localizedTextSchema, slugSchema, sortFields } from '../../utils/validators.js';

const createCaseStudy = z.strictObject({
  slug: slugSchema,
  title: localizedTextSchema,
  category: localizedTextSchema,
  image: assetSchema,
  content: localizedContentSchema,
  publishedAt: z.coerce.date().nullable().optional(),
  ...sortFields,
});

export const CaseStudyValidation = {
  create: createCaseStudy,
  update: createCaseStudy.partial(),
};
