import type { Service as ServiceRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicService } from './service.interface.js';

export const ServiceService = createContentService<ServiceRow, PublicService>(prisma.service, (row, locale) => ({
  id: row.id,
  slug: row.slug,
  title: pickText(row.title, locale),
  description: pickText(row.description, locale),
  image: row.image,
}));
