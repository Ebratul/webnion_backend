import type { z } from 'zod';
import type { UserValidation } from './user.validation.js';

export type CreateUserInput = z.infer<typeof UserValidation.create>;
export type UpdateUserInput = z.infer<typeof UserValidation.update>;
