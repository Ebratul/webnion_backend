import { z } from 'zod';

export const AuthValidation = {
  login: z.strictObject({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1).max(200),
  }),
};
