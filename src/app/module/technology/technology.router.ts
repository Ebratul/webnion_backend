import { createContentRouter } from '../../utils/content.js';
import { TechnologyController } from './technology.controller.js';
import { TechnologyValidation } from './technology.validation.js';

export const TechnologyRouter = createContentRouter(TechnologyController, TechnologyValidation);
