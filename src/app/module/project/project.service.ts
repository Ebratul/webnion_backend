import type { Project as ProjectRow } from '../../../generated/prisma/client.js';
import type { Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createContentService } from '../../utils/content.js';
import { pickContent, pickOptionalText, pickText } from '../../utils/localize.js';
import type { PublicProject, PublicProjectDetail } from './project.interface.js';

const toPublic = (row: ProjectRow, locale: Locale): PublicProject => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: pickText(row.category, locale),
  image: row.image,
  url: row.url,
  isFeatured: row.isFeatured,
});

const getPublicBySlug = async (slug: string, locale: Locale): Promise<PublicProjectDetail> => {
  const row = await prisma.project.findFirst({ where: { slug, isActive: true } });
  if (!row) throw new AppError(404, 'Project not found');

  const content = pickContent(row.content, locale);
  return {
    ...toPublic(row, locale),
    client: row.client,
    budget: pickOptionalText(row.budget, locale),
    location: pickOptionalText(row.location, locale),
    sector: pickOptionalText(row.sector, locale),
    completedAt: row.completedAt,
    content: content.blocks,
    contentLocale: content.locale,
  };
};

export const ProjectService = {
  ...createContentService<ProjectRow, PublicProject>(prisma.project, toPublic),
  getPublicBySlug,
};
