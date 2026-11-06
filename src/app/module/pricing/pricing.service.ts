import type { PricingPlan as PricingPlanRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickOptionalText, pickText } from '../../utils/localize.js';
import type { PublicPricing } from './pricing.interface.js';

export const PricingService = createContentService<PricingPlanRow, PublicPricing>(prisma.pricingPlan, (row, locale) => ({
  id: row.id,
  slug: row.slug,
  name: pickText(row.name, locale),
  tagline: pickText(row.tagline, locale),
  badge: row.badge ? pickText(row.badge, locale) : null,
  price: row.price,
  currency: row.currency,
  features: (row.features as unknown[]).map((feature) => pickText(feature, locale)),
  priceLabel: pickOptionalText(row.priceLabel, locale),
  buttonLabel: pickOptionalText(row.buttonLabel, locale),
  note: pickOptionalText(row.note, locale),
  isFeatured: row.isFeatured,
}));
