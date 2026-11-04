import { z } from 'zod';
import { assetSchema, httpUrlSchema, localizedTextSchema, slugSchema, sortFields } from '../../utils/validators.js';
import { PRODUCT_CATEGORIES, PRODUCT_PRICING, PRODUCT_SORTS, PRODUCT_TYPES } from './product.interface.js';

const createProduct = z.strictObject({
  slug: slugSchema,
  name: localizedTextSchema,
  summary: localizedTextSchema,
  image: assetSchema,
  type: z.enum(PRODUCT_TYPES),
  category: z.enum(PRODUCT_CATEGORIES),
  pricing: z.enum(PRODUCT_PRICING).default('PAID'),
  price: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  url: httpUrlSchema.nullable().optional(),
  views: z.number().int().min(0).optional(),
  isFeatured: z.boolean().default(false),
  ...sortFields,
});

// These come straight from the page's address, so an unknown value means "no filter" rather than an error
const anyOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional().catch(undefined);

export const ProductValidation = {
  create: createProduct,
  update: createProduct.partial(),
  search: z.object({
    q: z.string().trim().max(100).transform((value) => value || undefined).optional().catch(undefined),
    type: anyOf(PRODUCT_TYPES),
    category: anyOf(PRODUCT_CATEGORIES),
    pricing: anyOf(PRODUCT_PRICING),
    sort: z.enum(PRODUCT_SORTS).catch('featured'),
  }),
};
