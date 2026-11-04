import type { CaseStudy as CaseStudyRow } from '../../../generated/prisma/client.js';
import type { Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createContentService } from '../../utils/content.js';
import { pickContent, pickText } from '../../utils/localize.js';
import type { PublicCaseStudy, PublicCaseStudyDetail } from './case-study.interface.js';

const toPublic = (row: CaseStudyRow, locale: Locale): PublicCaseStudy => ({
  id: row.id,
  slug: row.slug,
  title: pickText(row.title, locale),
  category: pickText(row.category, locale),
  image: row.image,
  publishedAt: row.publishedAt,
  excerpt: pickContent(row.content, locale).blocks.find((block) => block.type === 'paragraph')?.text ?? '',
});

const getPublicBySlug = async (slug: string, locale: Locale): Promise<PublicCaseStudyDetail> => {
  const row = await prisma.caseStudy.findFirst({ where: { slug, isActive: true } });
  if (!row) throw new AppError(404, 'Case study not found');

  const content = pickContent(row.content, locale);
  return { ...toPublic(row, locale), content: content.blocks, contentLocale: content.locale };
};

export const CaseStudyService = {
  ...createContentService<CaseStudyRow, PublicCaseStudy>(prisma.caseStudy, toPublic),
  getPublicBySlug,
};
