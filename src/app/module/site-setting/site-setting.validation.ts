import { z } from 'zod';
import { assetSchema, httpUrlSchema } from '../../utils/validators.js';

const phone = z.string().trim().regex(/^\+?[\d\s-]{6,24}$/, 'Use digits, spaces and dashes only');

const contact = z.strictObject({
  email: z.email().max(200),
  phoneLocal: phone,
  phoneBdLabel: phone,
  phoneItLabel: phone,
  whatsappNumber: phone,
  facebook: httpUrlSchema,
  instagram: httpUrlSchema,
  privacy: httpUrlSchema,
});

const images = z.strictObject({
  outcomeFounder: assetSchema,
  outcomeHandover: assetSchema,
  outcomeTeam: assetSchema,
});

// Each entry replaces one piece of the site's built-in text. The path says which, such as hero.titleLines.0
const textOverrides = z.record(z.string().regex(/^[\w.]{1,120}$/), z.string().trim().min(1).max(5000));

const update = z
  .strictObject({
    contact: contact.optional(),
    images: images.optional(),
    text: z.strictObject({ en: textOverrides, bn: textOverrides }).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const SiteSettingValidation = { update };
