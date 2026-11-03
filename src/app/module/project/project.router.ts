import { createContentRouter } from '../../utils/content.js';
import { ProjectController } from './project.controller.js';
import { ProjectValidation } from './project.validation.js';

export const ProjectRouter = createContentRouter(ProjectController, ProjectValidation);
