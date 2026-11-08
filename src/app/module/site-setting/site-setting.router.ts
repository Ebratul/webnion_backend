import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { SiteSettingService } from './site-setting.service.js';
import { SiteSettingValidation } from './site-setting.validation.js';

export const SiteSettingRouter = Router();

SiteSettingRouter.get(
  '/',
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'Site settings retrieved', await SiteSettingService.get());
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
