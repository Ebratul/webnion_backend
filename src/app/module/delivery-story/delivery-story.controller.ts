import { createContentController } from '../../utils/content.js';
import { DeliveryStoryService } from './delivery-story.service.js';

export const DeliveryStoryController = createContentController(DeliveryStoryService, 'Delivery stories');
