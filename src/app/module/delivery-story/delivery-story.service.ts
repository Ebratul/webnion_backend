import type { DeliveryStory as DeliveryStoryRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicDeliveryStory } from './delivery-story.interface.js';

export const DeliveryStoryService = createContentService<DeliveryStoryRow, PublicDeliveryStory>(prisma.deliveryStory, (row, locale) => ({
  id: row.id,
  title: pickText(row.title, locale),
  caption: pickText(row.caption, locale),
  image: row.image,
}));
