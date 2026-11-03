import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { AuthController } from './auth.controller.js';
import { AuthValidation } from './auth.validation.js';

export const AuthRouter = Router();

AuthRouter.post('/login', loginLimiter, validateRequest({ body: AuthValidation.login }), AuthController.login);
AuthRouter.get('/me', auth(), AuthController.me);
