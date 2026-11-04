import { validateRequest } from '../../middleware/validateRequest.js';
import { createContentRouter } from '../../utils/content.js';
import { slugParamSchema } from '../../utils/validators.js';
import { ProjectController } from './project.controller.js';
import { ProjectValidation } from './project.validation.js';

export const ProjectRouter = createContentRouter(ProjectController, ProjectValidation);

ProjectRouter.get('/:slug', validateRequest({ params: slugParamSchema }), ProjectController.getBySlug);
