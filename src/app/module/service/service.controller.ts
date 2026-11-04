import { catchAsync } from '../../utils/catchAsync.js';
import { createContentController } from '../../utils/content.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ServiceService } from './service.service.js';

export const ServiceController = {
  ...createContentController(ServiceService, 'Services'),
  getBySlug: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Service retrieved', await ServiceService.getPublicBySlug(req.params.slug as string, getLocale(req)));
  }),
};
