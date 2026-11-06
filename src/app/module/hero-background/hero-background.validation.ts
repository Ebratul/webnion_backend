import { z } from 'zod';
import { assetSchema, sortFields } from '../../utils/validators.js';

const createHeroBackground = z.strictObject({
  name: z.string().trim().min(1).max(120),
  image: assetSchema,
  ...sortFields,
});

export const HeroBackgroundValidation = {
  create: createHeroBackground,
  update: createHeroBackground.partial(),
};
