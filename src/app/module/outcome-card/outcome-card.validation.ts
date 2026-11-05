import { z } from 'zod';
import { assetSchema, localizedTextSchema, nullableJson, sortFields } from '../../utils/validators.js';

// A section on the page (#contact), a page on the site (/contact) or a full address. A protocol-relative //address is refused.
const buttonUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^(#[\w-]+|\/(?!\/).*|https?:\/\/.+)$/.test(value), 'Use #section, /page or a full http(s) address');

const createOutcomeCard = z.strictObject({
  eyebrow: nullableJson(localizedTextSchema),
  title: localizedTextSchema,
  description: localizedTextSchema,
  points: z.array(localizedTextSchema).max(8),
  image: assetSchema,
  buttonLabel: nullableJson(localizedTextSchema),
  buttonUrl: buttonUrlSchema.nullable().optional(),
  ...sortFields,
});

export const OutcomeCardValidation = {
  create: createOutcomeCard,
  update: createOutcomeCard.partial(),
};
