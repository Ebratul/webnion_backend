import type { BlogPost, Prisma } from '../../../generated/prisma/client.js';
import type { ContentBlock, Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { pickContent } from '../../utils/localize.js';

// Bangla is optional on posts and saved as an empty string, which falls back to English
const pickText = (value: unknown, locale: Locale) => {
  const text = value as Partial<Record<Locale, string>> | null;
  return text?.[locale] || text?.en || '';
};

// Each topic once, whatever its case
const tagsOf = (row: BlogPost) => [...new Map((row.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()];

// About 200 words a minute, at least one
const readingMinutes = (blocks: ContentBlock[]) => {
  const words = blocks.flatMap((block) => ('text' in block ? [block.text] : 'items' in block ? block.items : [])).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

const toSummary = (row: BlogPost, locale: Locale) => {
  const content = pickContent(row.content, locale);
  return {
    id: row.id,
    slug: row.slug,
    title: pickText(row.title, locale),
    excerpt: pickText(row.excerpt, locale) || (content.blocks.find((block) => block.type === 'paragraph') as { text?: string } | undefined)?.text?.slice(0, 220) || '',
    cover: row.cover,
    coverAlt: pickText(row.coverAlt, locale),
    tags: tagsOf(row),
    publishedAt: row.publishedAt,
    authorName: row.authorName,
    readingMinutes: readingMinutes(content.blocks),
  };
};

// A post with a future date is scheduled: it stays hidden until then
const published = (): Prisma.BlogPostWhereInput => ({ status: 'PUBLISHED', publishedAt: { lte: new Date() } });
const newestFirst: Prisma.BlogPostOrderByWithRelationInput[] = [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

const listPublic = async (locale: Locale, tag?: string, take = 100) => {
  const rows = await prisma.blogPost.findMany({ where: { ...published(), ...(tag ? { tags: { contains: tag } } : {}) }, orderBy: newestFirst, take });
  return rows.map((row) => toSummary(row, locale)).filter((post) => !tag || post.tags.some((item) => item.toLowerCase() === tag.toLowerCase()));
};

const getPublicBySlug = async (slug: string, locale: Locale) => {
  const row = await prisma.blogPost.findFirst({ where: { ...published(), slug } });
  if (!row) throw new AppError(404, 'Post not found');
  const content = pickContent(row.content, locale);
  const tags = tagsOf(row);
  const others = await prisma.blogPost.findMany({ where: { ...published(), id: { not: row.id } }, orderBy: newestFirst, take: 20 });
  // Posts sharing a tag first, then the newest
  const related = others
    .map((other) => ({ other, shared: tagsOf(other).filter((tag) => tags.includes(tag)).length }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map(({ other }) => toSummary(other, locale));
  return {
    ...toSummary(row, locale),
    content: content.blocks,
    contentLocale: content.locale,
    seoTitle: pickText(row.seoTitle, locale),
    seoDescription: pickText(row.seoDescription, locale),
    updatedAt: row.updatedAt,
    hasBangla: Boolean((row.content as { bn?: unknown[] }).bn?.length),
    related,
  };
};

const listAll = () => prisma.blogPost.findMany({ orderBy: [{ updatedAt: 'desc' }] });

const getById = async (id: string) => {
  const row = await prisma.blogPost.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Post not found');
  return row;
};

// A post goes live with a date, so publishing without one uses now
const withPublishDate = async (data: Record<string, unknown>, id?: string) => {
  if (data.status !== 'PUBLISHED' || data.publishedAt) return data;
  const existing = id ? await prisma.blogPost.findUnique({ where: { id }, select: { publishedAt: true } }) : null;
  return existing?.publishedAt ? data : { ...data, publishedAt: new Date() };
};

const create = async (data: Record<string, unknown>) => prisma.blogPost.create({ data: (await withPublishDate(data)) as Prisma.BlogPostCreateInput });

const update = async (id: string, data: Record<string, unknown>) => prisma.blogPost.update({ where: { id }, data: (await withPublishDate(data, id)) as Prisma.BlogPostUpdateInput });

const remove = (id: string) => prisma.blogPost.delete({ where: { id } });

// A slug that is not taken yet, for drafts made by the AI writer
const freeSlug = async (base: string) => {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const slug = attempt === 1 ? clean : `${clean}-${attempt}`;
    if (!(await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${clean}-${Date.now()}`;
};

export const BlogPostService = { listPublic, getPublicBySlug, listAll, getById, create, update, remove, freeSlug, toSummary };
