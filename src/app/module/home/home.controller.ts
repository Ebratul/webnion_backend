import { catchAsync } from '../../utils/catchAsync.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { HomeService } from './home.service.js';

const getHome = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Homepage content retrieved', await HomeService.getHome(getLocale(req)));
});

export const HomeController = { getHome };
