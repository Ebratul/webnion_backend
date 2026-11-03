import { createContentRouter } from '../../utils/content.js';
import { ServiceController } from './service.controller.js';
import { ServiceValidation } from './service.validation.js';

export const ServiceRouter = createContentRouter(ServiceController, ServiceValidation);
