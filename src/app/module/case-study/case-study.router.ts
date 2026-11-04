import { validateRequest } from '../../middleware/validateRequest.js';
import { createContentRouter } from '../../utils/content.js';
import { slugParamSchema } from '../../utils/validators.js';
import { CaseStudyController } from './case-study.controller.js';
import { CaseStudyValidation } from './case-study.validation.js';

export const CaseStudyRouter = createContentRouter(CaseStudyController, CaseStudyValidation);

CaseStudyRouter.get('/:slug', validateRequest({ params: slugParamSchema }), CaseStudyController.getBySlug);
