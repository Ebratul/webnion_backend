import { createContentRouter } from '../../utils/content.js';
import { PricingController } from './pricing.controller.js';
import { PricingValidation } from './pricing.validation.js';

export const PricingRouter = createContentRouter(PricingController, PricingValidation);
