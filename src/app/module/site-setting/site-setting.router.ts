import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { isMailConfigured } from '../../lib/mailer.js';
import { SiteSettingService } from './site-setting.service.js';
import { SiteSettingValidation } from './site-setting.validation.js';

export const SiteSettingRouter = Router();

SiteSettingRouter.get(
  '/',
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'Site settings retrieved', await SiteSettingService.get());
  }),
);

// For the admin panel: whether emails can be sent at all, so it can say so next to the inquiry email setting
SiteSettingRouter.get(
  '/status',
  auth(),
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'Status retrieved', { mailConfigured: isMailConfigured() });
  }),
);

SiteSettingRouter.patch(
  '/',
  auth(),
  validateRequest({ body: SiteSettingValidation.update }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Site settings updated', await SiteSettingService.update(req.body));
  }),
);
