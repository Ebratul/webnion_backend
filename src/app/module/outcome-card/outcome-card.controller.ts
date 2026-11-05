import { createContentController } from '../../utils/content.js';
import { OutcomeCardService } from './outcome-card.service.js';

export const OutcomeCardController = createContentController(OutcomeCardService, 'Outcome cards');
