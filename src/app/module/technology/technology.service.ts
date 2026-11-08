import type { Technology as TechnologyRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicTechnology } from './technology.interface.js';

export const TechnologyService = createContentService<TechnologyRow, PublicTechnology>(prisma.technology, (row, locale) => ({
  id: row.id,
  name: row.name,
  description: pickText(row.description, locale),
  logo: row.logo,
}));
