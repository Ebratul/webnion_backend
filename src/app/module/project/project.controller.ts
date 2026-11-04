import { catchAsync } from '../../utils/catchAsync.js';
import { createContentController } from '../../utils/content.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ProjectService } from './project.service.js';

export const ProjectController = {
  ...createContentController(ProjectService, 'Projects'),
  getBySlug: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Project retrieved', await ProjectService.getPublicBySlug(req.params.slug as string, getLocale(req)));
  }),
};
