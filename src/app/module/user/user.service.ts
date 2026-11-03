import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import type { CreateUserInput, UpdateUserInput } from './user.interface.js';

const safeFields = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

const list = () => prisma.user.findMany({ select: safeFields, orderBy: { createdAt: 'asc' } });

const create = async ({ password, ...data }: CreateUserInput) =>
  prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    select: safeFields,
  });

const update = async (id: string, actorId: string, { password, ...data }: UpdateUserInput) => {
  if (id === actorId && (data.isActive === false || (data.role && data.role !== 'ADMIN'))) {
    throw new AppError(400, 'You cannot deactivate or demote your own account');
  }

  return prisma.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select: safeFields,
  });
};

const remove = async (id: string, actorId: string) => {
  if (id === actorId) throw new AppError(400, 'You cannot delete your own account');
  await prisma.user.delete({ where: { id } });
};

export const UserService = { list, create, update, remove };
