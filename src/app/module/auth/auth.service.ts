import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import type { LoginInput } from './auth.interface.js';

// Compared when the email is unknown so response time does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('webnion-dummy-password', 10);

const login = async ({ email, password }: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user?.isActive || !passwordMatches) throw new AppError(401, 'Incorrect email or password');

  const token = jwt.sign({}, config.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
};

const me = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new AppError(401, 'Invalid or expired token');
  return user;
};

export const AuthService = { login, me };
