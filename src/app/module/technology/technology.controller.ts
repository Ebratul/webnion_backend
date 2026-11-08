import { createContentController } from '../../utils/content.js';
import { TechnologyService } from './technology.service.js';

export const TechnologyController = createContentController(TechnologyService, 'Technologies');
