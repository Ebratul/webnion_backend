import type { Faq as FaqRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicFaq } from './faq.interface.js';

export const FaqService = createContentService<FaqRow, PublicFaq>(prisma.faq, (row, locale) => ({
  id: row.id,
  question: pickText(row.question, locale),
  answer: pickText(row.answer, locale),
}));
