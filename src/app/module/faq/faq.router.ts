import { createContentRouter } from '../../utils/content.js';
import { FaqController } from './faq.controller.js';
import { FaqValidation } from './faq.validation.js';

export const FaqRouter = createContentRouter(FaqController, FaqValidation);
