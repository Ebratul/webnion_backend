import { createContentRouter } from '../../utils/content.js';
import { DeliveryStoryController } from './delivery-story.controller.js';
import { DeliveryStoryValidation } from './delivery-story.validation.js';

export const DeliveryStoryRouter = createContentRouter(DeliveryStoryController, DeliveryStoryValidation);
