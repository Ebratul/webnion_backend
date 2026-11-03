import { createContentController } from '../../utils/content.js';
import { ProjectService } from './project.service.js';

export const ProjectController = createContentController(ProjectService, 'Projects');
