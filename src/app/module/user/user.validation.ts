import { z } from 'zod';

const createUser = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10, 'Password must be at least 10 characters').max(72),
  role: z.enum(['ADMIN', 'EDITOR']).optional(),
});

export const UserValidation = {
  create: createUser,
  update: createUser.partial().extend({ isActive: z.boolean().optional() }),
};
