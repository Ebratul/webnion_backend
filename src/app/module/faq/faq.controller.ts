import { createContentController } from '../../utils/content.js';
import { FaqService } from './faq.service.js';

export const FaqController = createContentController(FaqService, 'FAQs');
