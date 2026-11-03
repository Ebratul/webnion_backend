import { createContentController } from '../../utils/content.js';
import { ServiceService } from './service.service.js';

export const ServiceController = createContentController(ServiceService, 'Services');
