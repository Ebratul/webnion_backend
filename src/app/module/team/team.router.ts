import { createContentRouter } from '../../utils/content.js';
import { TeamController } from './team.controller.js';
import { TeamValidation } from './team.validation.js';

export const TeamRouter = createContentRouter(TeamController, TeamValidation);
