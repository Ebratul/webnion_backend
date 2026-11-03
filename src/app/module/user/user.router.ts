import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { idParamSchema } from '../../utils/validators.js';
import { UserController } from './user.controller.js';
import { UserValidation } from './user.validation.js';

export const UserRouter = Router();

UserRouter.use(auth('ADMIN'));

UserRouter.get('/', UserController.list);
UserRouter.post('/', validateRequest({ body: UserValidation.create }), UserController.create);
UserRouter.patch('/:id', validateRequest({ params: idParamSchema, body: UserValidation.update }), UserController.update);
UserRouter.delete('/:id', validateRequest({ params: idParamSchema }), UserController.remove);
