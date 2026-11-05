import type { OutcomeCard as OutcomeCardRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickOptionalText, pickText } from '../../utils/localize.js';
import type { PublicOutcomeCard } from './outcome-card.interface.js';

export const OutcomeCardService = createContentService<OutcomeCardRow, PublicOutcomeCard>(prisma.outcomeCard, (row, locale) => ({
  id: row.id,
  eyebrow: pickOptionalText(row.eyebrow, locale),
  title: pickText(row.title, locale),
  description: pickText(row.description, locale),
  points: (row.points as unknown[]).map((point) => pickText(point, locale)),
  image: row.image,
  buttonLabel: pickOptionalText(row.buttonLabel, locale),
  buttonUrl: row.buttonUrl,
}));
