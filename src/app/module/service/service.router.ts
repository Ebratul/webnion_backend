import { validateRequest } from '../../middleware/validateRequest.js';
import { createContentRouter } from '../../utils/content.js';
import { slugParamSchema } from '../../utils/validators.js';
import { ServiceController } from './service.controller.js';
import { ServiceValidation } from './service.validation.js';

export const ServiceRouter = createContentRouter(ServiceController, ServiceValidation);

ServiceRouter.get('/:slug', validateRequest({ params: slugParamSchema }), ServiceController.getBySlug);
