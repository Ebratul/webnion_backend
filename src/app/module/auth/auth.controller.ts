import { AppError } from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ActivityLogService, clientIp } from '../activity-log/activity-log.service.js';
import { AuthService } from './auth.service.js';

const login = catchAsync(async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    const { id, name, email } = result.user;
    await ActivityLogService.record({ action: 'LOGIN', summary: `${name} logged in`, actorId: id, actorName: name, actorEmail: email, ip: clientIp(req) });
    sendResponse(res, 200, 'Logged in', result);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      const email = String(req.body.email);
      await ActivityLogService.record({ action: 'LOGIN_FAILED', summary: `Failed login for ${email}`, actorEmail: email, ip: clientIp(req) });
    }
    throw error;
  }
});

const logout = catchAsync(async (req, res) => {
  const { id, name, email } = req.user!;
  await ActivityLogService.record({ action: 'LOGOUT', summary: `${name} logged out`, actorId: id, actorName: name, actorEmail: email, ip: clientIp(req) });
  sendResponse(res, 200, 'Logged out');
});

const me = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Current user retrieved', await AuthService.me(req.user!.id));
});

export const AuthController = { login, logout, me };
