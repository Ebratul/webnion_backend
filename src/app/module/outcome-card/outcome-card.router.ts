import { createContentRouter } from '../../utils/content.js';
import { OutcomeCardController } from './outcome-card.controller.js';
import { OutcomeCardValidation } from './outcome-card.validation.js';

export const OutcomeCardRouter = createContentRouter(OutcomeCardController, OutcomeCardValidation);
