export interface PublicPricing {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  badge: string | null;
  price: number;
  currency: string;
  features: string[];
  isFeatured: boolean;
}
