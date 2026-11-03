import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { AuthService } from './auth.service.js';

const login = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Logged in', await AuthService.login(req.body));
});

const me = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'Current user retrieved', await AuthService.me(req.user!.id));
});

export const AuthController = { login, me };
