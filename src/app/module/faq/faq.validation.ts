import { z } from 'zod';
import { localizedTextSchema, sortFields } from '../../utils/validators.js';

const createFaq = z.strictObject({
  question: localizedTextSchema,
  answer: localizedTextSchema,
  ...sortFields,
});

export const FaqValidation = {
  create: createFaq,
  update: createFaq.partial(),
};
