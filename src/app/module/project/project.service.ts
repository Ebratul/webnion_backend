import type { Project as ProjectRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicProject } from './project.interface.js';

export const ProjectService = createContentService<ProjectRow, PublicProject>(prisma.project, (row, locale) => ({
  id: row.id,
  name: row.name,
  category: pickText(row.category, locale),
  image: row.image,
  url: row.url,
  isFeatured: row.isFeatured,
}));
