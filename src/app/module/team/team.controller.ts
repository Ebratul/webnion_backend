import { createContentController } from '../../utils/content.js';
import { TeamService } from './team.service.js';

export const TeamController = createContentController(TeamService, 'Team members');
