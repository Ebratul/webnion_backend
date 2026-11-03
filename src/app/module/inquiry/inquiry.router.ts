import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { inquiryLimiter } from '../../middleware/rateLimiter.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { idParamSchema } from '../../utils/validators.js';
import { InquiryController } from './inquiry.controller.js';
import { InquiryValidation } from './inquiry.validation.js';

export const InquiryRouter = Router();

InquiryRouter.post('/', inquiryLimiter, validateRequest({ body: InquiryValidation.create }), InquiryController.create);
InquiryRouter.get('/', auth(), InquiryController.list);
InquiryRouter.patch(
  '/:id',
  auth(),
  validateRequest({ params: idParamSchema, body: InquiryValidation.update }),
  InquiryController.update,
);
