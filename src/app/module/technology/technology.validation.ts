import { z } from 'zod';
import { assetSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createTechnology = z.strictObject({
  name: z.string().trim().min(1).max(80),
  description: localizedTextSchema,
  logo: assetSchema,
  ...sortFields,
});

export const TechnologyValidation = {
  create: createTechnology,
  update: createTechnology.partial(),
};
