export const PRODUCT_TYPES = ['laravel-software', 'website-template', 'plugin', 'web-tool', 'custom-software', 'business-website'] as const;
export const PRODUCT_CATEGORIES = ['e-commerce', 'business-corporate', 'marketing-automation', 'management-systems', 'developer-tools'] as const;
export const PRODUCT_PRICING = ['FREE', 'PAID', 'CONTACT'] as const;
export const PRODUCT_SORTS = ['featured', 'latest', 'popular', 'price_low', 'price_high'] as const;

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  summary: string;
  image: string;
  type: string;
  category: string;
  pricing: string;
  price: number | null;
  currency: string;
  url: string | null;
  isFeatured: boolean;
}

export interface ProductSearch {
  q?: string;
  type?: (typeof PRODUCT_TYPES)[number];
  category?: (typeof PRODUCT_CATEGORIES)[number];
  pricing?: (typeof PRODUCT_PRICING)[number];
  sort: (typeof PRODUCT_SORTS)[number];
}

export interface ProductSearchResult {
  products: PublicProduct[];
  typeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}
