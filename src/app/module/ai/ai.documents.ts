import { createHash } from 'node:crypto';
import type { Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { SiteSettingService } from '../site-setting/site-setting.service.js';
import { AiSettings } from './ai.settings.js';

// One record of site content in one language, as the AI service indexes it
export interface AiDocument {
  type: string;
  id: string;
  locale: Locale;
  title: string;
  url: string;
  text: string;
  updated_at: string;
}

const LOCALES: Locale[] = ['en', 'bn'];
// Fields that hold addresses, ids or layout values rather than words a visitor would ask about
const SKIP = /^(id|slug|image|images|video|videoUrl|poster|icon|logo|src|href|url|link|color|colour|sortOrder|isActive|isFeatured|createdAt|updatedAt|publishedAt|completedAt|type|category$|avatar|photo|thumbnail|cover|status|aiMeta)$/i;
const LOOKS_LIKE_ADDRESS = /^(https?:\/\/|\/|#|[0-9a-f-]{36}$)/i;

type Json = unknown;

const isLocalized = (value: Json): value is Partial<Record<Locale, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && ('en' in value || 'bn' in value);

// Collects the readable text from a field: plain strings, { en, bn } values and article blocks
const textOf = (value: Json, locale: Locale): string[] => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return value && !LOOKS_LIKE_ADDRESS.test(value) ? [value] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [];
  if (Array.isArray(value)) return value.flatMap((item) => textOf(item, locale));
  if (isLocalized(value)) {
    const picked = value[locale] ?? value.en;
    return textOf(picked, locale);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, Json>;
    if (record.type === 'image') return record.alt ? [String(record.alt)] : [];
    if (record.type === 'heading' && typeof record.text === 'string') return [`\n${record.text}`];
    if (record.type === 'list' && Array.isArray(record.items)) return record.items.map((item) => `- ${String(item)}`);
    return Object.entries(record).flatMap(([key, item]) => (SKIP.test(key) ? [] : textOf(item, locale)));
  }
  return [];
};

const titleOf = (row: Record<string, Json>, locale: Locale) => {
  for (const key of ['title', 'name', 'question', 'heading']) {
    const [text] = textOf(row[key], locale);
    if (text) return text.trim().slice(0, 300);
  }
  return '';
};

// A record counts in a language only when it really has text in it, so Bangla falls back to nothing rather than to English
const hasLocale = (row: Record<string, Json>, locale: Locale) =>
  locale === 'en' || Object.values(row).some((value) => isLocalized(value) && typeof value.bn === 'string' && value.bn.trim() !== '') || Object.values(row).some((value) => isLocalized(value) && Array.isArray(value.bn) && value.bn.length > 0);

const rowsToDocuments = (type: string, rows: Record<string, Json>[], url: (row: Record<string, Json>, locale: Locale) => string) =>
  rows.flatMap((row) =>
    LOCALES.filter((locale) => hasLocale(row, locale)).map((locale): AiDocument => {
      const title = titleOf(row, locale);
      // Numbers are left out as field values, so a price is written out as a sentence the assistant can quote
      const price = typeof row.price === 'number' ? [`Price: ${[textOf(row.priceLabel, locale)[0], row.price, row.currency].filter((part) => part !== undefined && part !== '').join(' ')}`] : [];
      const body = [
        ...price,
        ...Object.entries(row)
          .filter(([key]) => !SKIP.test(key) && !['title', 'name', 'currency', 'priceLabel'].includes(key))
          .flatMap(([, value]) => textOf(value, locale)),
      ]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { type, id: String(row.id), locale, title, url: url(row, locale), text: body.slice(0, 60_000), updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : '' };
    }),
  );

const contactDocuments = async (): Promise<AiDocument[]> => {
  const settings = await SiteSettingService.get();
  const contact = settings.contact ?? {};
  const navigation = (settings.navigation ?? {}) as { offices?: { name?: unknown; address?: unknown }[] };
  const options = (settings.options ?? {}) as { budgets?: unknown[] };
  // Never saved: the website shows its built-in details, which come with the site text snapshot instead
  if (!settings.contact && !navigation.offices?.length) return [];
  return LOCALES.map((locale) => {
    const lines = [
      contact.email && `Email: ${contact.email}`,
      contact.phoneBdLabel && `Phone (Bangladesh): ${contact.phoneBdLabel}`,
      contact.phoneLocal && `Local phone: ${contact.phoneLocal}`,
      contact.phoneItLabel && `Phone (Italy): ${contact.phoneItLabel}`,
      contact.whatsappNumber && `WhatsApp: ${contact.whatsappNumber}`,
      ...(navigation.offices ?? []).map((office) => `Office: ${textOf(office.name, locale).join(' ')}, ${textOf(office.address, locale).join(' ')}`),
      options.budgets?.length ? `Budget ranges on the inquiry form: ${textOf(options.budgets, locale).join(', ')}` : '',
    ].filter(Boolean);
    return { type: 'contact', id: 'contact', locale, title: locale === 'bn' ? 'যোগাযোগ' : 'Contact details', url: `/${locale}/contact`, text: lines.join('\n'), updated_at: '' };
  });
};

const siteTextDocuments = async (): Promise<AiDocument[]> => {
  const snapshot = await AiSettings.loadSiteText();
  return LOCALES.flatMap((locale) => (snapshot[locale] ?? []).map((item) => ({ type: 'site-text', id: item.id, locale, title: item.title, url: item.url, text: item.text, updated_at: '' })));
};

const active = { where: { isActive: true } };

// Everything a visitor might ask about, in both languages
const build = async (): Promise<AiDocument[]> => {
  const [services, projects, products, caseStudies, faqs, pricing, team, technologies, posts, contact, siteText] = await Promise.all([
    prisma.service.findMany(active),
    prisma.project.findMany(active),
    prisma.product.findMany(active),
    prisma.caseStudy.findMany(active),
    prisma.faq.findMany(active),
    prisma.pricingPlan.findMany(active),
    prisma.teamMember.findMany(active),
    prisma.technology.findMany(active),
    prisma.blogPost.findMany({ where: { status: 'PUBLISHED' } }),
    contactDocuments(),
    siteTextDocuments(),
  ]);
  const rows = (items: unknown[]) => items as Record<string, Json>[];

  const technologyNames = technologies.map((row) => textOf((row as Record<string, Json>).name, 'en').join(' ')).filter(Boolean);
  const technologyDocs: AiDocument[] = technologyNames.length
    ? LOCALES.map((locale) => ({ type: 'technologies', id: 'all', locale, title: locale === 'bn' ? 'আমরা যেসব টেকনোলজি ব্যবহার করি' : 'Technologies we use', url: `/${locale}`, text: technologyNames.join(', '), updated_at: '' }))
    : [];

  return [
    ...rowsToDocuments('service', rows(services), (row, locale) => `/${locale}/services/${row.slug}`),
    ...rowsToDocuments('project', rows(projects), (row, locale) => `/${locale}/project/${row.slug}`),
    ...rowsToDocuments('product', rows(products), (_row, locale) => `/${locale}/products`),
    ...rowsToDocuments('case-study', rows(caseStudies), (row, locale) => `/${locale}/case-studies/${row.slug}`),
    ...rowsToDocuments('faq', rows(faqs), (_row, locale) => `/${locale}`),
    ...rowsToDocuments('pricing', rows(pricing), (_row, locale) => `/${locale}#pricing`),
    ...rowsToDocuments('team', rows(team), (_row, locale) => `/${locale}/team`),
    ...rowsToDocuments('blog', rows(posts), (row, locale) => `/${locale}/blog/${row.slug}`),
    ...technologyDocs,
    ...contact,
    ...siteText,
  ].filter((document) => document.text || document.title);
};

export const documentKey = (document: Pick<AiDocument, 'type' | 'id' | 'locale'>) => `${document.type}:${document.id}:${document.locale}`;
export const documentHash = (document: AiDocument) => createHash('sha256').update(JSON.stringify([document.title, document.url, document.text])).digest('hex');

// Chat without Pinecone sends the records with every message, so they are kept for a few minutes per running copy
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; documents: AiDocument[] } | null = null;

const cachedForChat = async () => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.documents;
  // The AI service accepts up to 600 records, and Vercel up to 4.5 MB per request
  const documents = (await build()).slice(0, 600).map((document) => ({ ...document, text: document.text.slice(0, 6000) }));
  cached = { at: Date.now(), documents };
  return documents;
};

// Letters, numbers and marks: without \p{M} Bangla words split at their vowel signs
const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const words = (text: string) => new Set((text.toLowerCase().match(WORD) ?? []).filter((word) => word.length > 1));
// Records that should always be at hand: how to get in touch
const ALWAYS = new Set(['contact', 'site-text:contact-details']);

// Without Pinecone the records travel with every message. Sending only those that share words with the question keeps
// each request small; the AI service then ranks the passages properly. Rare words count more than common ones, so
// "starter" finds the pricing plan while "how" and "the" decide nothing.
const forQuery = async (query: string, limit = 30) => {
  const documents = await cachedForChat();
  const indexed = documents.map((document) => ({ document, title: words(document.title), body: words(document.text) }));
  const terms = [...words(query)];
  const rarity = new Map(terms.map((term) => [term, Math.log((indexed.length + 1) / (indexed.filter((item) => item.title.has(term) || item.body.has(term)).length + 0.5))]));
  const scored = indexed.map(({ document, title, body }) => ({
    document,
    score: terms.reduce((sum, term) => sum + Math.max(rarity.get(term)!, 0) * ((title.has(term) ? 3 : 0) + (body.has(term) ? 1 : 0)), 0),
  }));
  const always = scored.filter(({ document }) => ALWAYS.has(document.type) || ALWAYS.has(`${document.type}:${document.id}`));
  const matching = scored.filter((item) => item.score > 0.5 && !always.includes(item)).sort((a, b) => b.score - a.score);
  // Nothing in common, such as a greeting: the questions, answers and plans still help
  const fallback = matching.length ? [] : scored.filter(({ document }) => document.type === 'faq' || document.type === 'pricing');
  return [...always, ...matching, ...fallback].slice(0, limit).map(({ document }) => document);
};

export const AiDocuments = { build, cachedForChat, forQuery, clearCache: () => (cached = null) };
