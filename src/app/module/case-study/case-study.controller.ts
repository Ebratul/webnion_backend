import { catchAsync } from '../../utils/catchAsync.js';
import { createContentController } from '../../utils/content.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { CaseStudyService } from './case-study.service.js';

export const CaseStudyController = {
  ...createContentController(CaseStudyService, 'Case studies'),
  getBySlug: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Case study retrieved', await CaseStudyService.getPublicBySlug(req.params.slug as string, getLocale(req)));
  }),
};
