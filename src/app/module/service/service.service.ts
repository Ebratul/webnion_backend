import type { Service as ServiceRow } from '../../../generated/prisma/client.js';
import type { ContentBlock, Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createContentService } from '../../utils/content.js';
import { pickContent, pickText } from '../../utils/localize.js';
import type { PublicService, PublicServiceDetail, ServiceFaq } from './service.interface.js';

const toPublic = (row: ServiceRow, locale: Locale): PublicService => ({
  id: row.id,
  slug: row.slug,
  title: pickText(row.title, locale),
  description: pickText(row.description, locale),
  image: row.image,
});

// FAQs are edited with the content editor: each heading starts a question, and paragraphs after it form the answer
const toFaqs = (blocks: ContentBlock[]) =>
  blocks.reduce<ServiceFaq[]>((faqs, block) => {
    if (block.type === 'heading') return [...faqs, { question: block.text, answer: '' }];
    const current = faqs.at(-1);
    if (block.type === 'paragraph' && current) current.answer = `${current.answer} ${block.text}`.trim();
    return faqs;
  }, []);

const getPublicBySlug = async (slug: string, locale: Locale): Promise<PublicServiceDetail> => {
  const row = await prisma.service.findFirst({ where: { slug, isActive: true } });
  if (!row) throw new AppError(404, 'Service not found');

  const content = pickContent(row.content, locale);
  const faqs = pickContent(row.faqs, locale);
  return {
    ...toPublic(row, locale),
    content: content.blocks,
    contentLocale: content.locale,
    faqs: toFaqs(faqs.blocks).filter((faq) => faq.answer),
    faqsLocale: faqs.locale,
  };
};

export const ServiceService = {
  ...createContentService<ServiceRow, PublicService>(prisma.service, toPublic),
  getPublicBySlug,
};
