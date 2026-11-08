import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middleware/auth.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ACTIVITY_ACTIONS, ActivityLogService } from './activity-log.service.js';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
  action: z.enum(ACTIVITY_ACTIONS).optional().catch(undefined),
  q: z.string().trim().max(120).optional().catch(undefined),
});

export const ActivityLogRouter = Router();

// IP addresses and login attempts are in here, so editors do not see it
ActivityLogRouter.get(
  '/',
  auth('ADMIN'),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Activity retrieved', await ActivityLogService.list(listQuery.parse(req.query)));
  }),
);
