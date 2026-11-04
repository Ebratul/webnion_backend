import type { Product as ProductRow } from '../../../generated/prisma/client.js';
import type { Locale } from '../../interfaces/index.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { ProductSearch, ProductSearchResult, PublicProduct } from './product.interface.js';

const toPublic = (row: ProductRow, locale: Locale): PublicProduct => ({
  id: row.id,
  slug: row.slug,
  name: pickText(row.name, locale),
  summary: pickText(row.summary, locale),
  image: row.image,
  type: row.type,
  category: row.category,
  pricing: row.pricing,
  price: row.price,
  currency: row.currency,
  url: row.url,
  isFeatured: row.isFeatured,
});

const countBy = (rows: ProductRow[], field: 'type' | 'category') =>
  rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row[field]]: (counts[row[field]] ?? 0) + 1 }), {});

const matchesText = (row: ProductRow, query: string) => {
  const haystack = `${JSON.stringify(row.name)} ${JSON.stringify(row.summary)}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

// Products without a price sort last in both directions
const priceOrder = (a: ProductRow, b: ProductRow, direction: 1 | -1) => {
  if (a.price === null) return b.price === null ? 0 : 1;
  if (b.price === null) return -1;
  return (a.price - b.price) * direction;
};

const COMPARE: Record<ProductSearch['sort'], (a: ProductRow, b: ProductRow) => number> = {
  featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder,
  latest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  popular: (a, b) => b.views - a.views,
  price_low: (a, b) => priceOrder(a, b, 1),
  price_high: (a, b) => priceOrder(a, b, -1),
};

// The catalog is small, so filtering in memory keeps text search across both languages simple
const search = async (locale: Locale, { q, type, category, pricing, sort }: ProductSearch): Promise<ProductSearchResult> => {
  const active = await prisma.product.findMany({ where: { isActive: true } });
  const matching = active
    .filter((row) => (!q || matchesText(row, q)) && (!type || row.type === type) && (!category || row.category === category) && (!pricing || row.pricing === pricing))
    .sort(COMPARE[sort]);

  return {
    products: matching.map((row) => toPublic(row, locale)),
    typeCounts: countBy(active, 'type'),
    categoryCounts: countBy(active, 'category'),
  };
};

export const ProductService = {
  ...createContentService<ProductRow, PublicProduct>(prisma.product, toPublic),
  search,
};
