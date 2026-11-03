import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { UserService } from './user.service.js';

const list = catchAsync(async (_req, res) => {
  sendResponse(res, 200, 'Users retrieved', await UserService.list());
});

const create = catchAsync(async (req, res) => {
  sendResponse(res, 201, 'User created', await UserService.create(req.body));
});

const update = catchAsync(async (req, res) => {
  sendResponse(res, 200, 'User updated', await UserService.update(req.params.id as string, req.user!.id, req.body));
});

const remove = catchAsync(async (req, res) => {
  await UserService.remove(req.params.id as string, req.user!.id);
  sendResponse(res, 200, 'User deleted');
});

export const UserController = { list, create, update, remove };
