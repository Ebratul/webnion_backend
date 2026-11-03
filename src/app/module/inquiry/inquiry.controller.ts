import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { InquiryService } from './inquiry.service.js';

const create = catchAsync(async (req, res) => {
  await InquiryService.create(req.body);
  sendResponse(res, 201, 'Inquiry received');
});

const list = catchAsync(async (_req, res) => {
  sendResponse(res, 200, 'Inquiries retrieved', await InquiryService.list());
});

const update = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Inquiry updated', await InquiryService.update(req.params.id as string, req.body));
});

export const InquiryController = { create, list, update };
