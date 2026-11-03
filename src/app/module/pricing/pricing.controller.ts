import { createContentController } from '../../utils/content.js';
import { PricingService } from './pricing.service.js';

export const PricingController = createContentController(PricingService, 'Pricing plans');
