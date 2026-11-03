import type { z } from 'zod';
import type { AuthValidation } from './auth.validation.js';

export type LoginInput = z.infer<typeof AuthValidation.login>;
