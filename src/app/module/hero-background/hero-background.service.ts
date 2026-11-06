import type { HeroBackground as HeroBackgroundRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import type { PublicHeroBackground } from './hero-background.interface.js';

export const HeroBackgroundService = createContentService<HeroBackgroundRow, PublicHeroBackground>(prisma.heroBackground, (row) => ({
  id: row.id,
  image: row.image,
}));
