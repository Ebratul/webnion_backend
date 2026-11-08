import jwt from 'jsonwebtoken';
import { Role } from '../../generated/prisma/client.js';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const auth = (...roles: Role[]) =>
  catchAsync(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required');

    let userId: string | undefined;
    try {
      const payload = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ['HS256'] });
      userId = typeof payload === 'string' ? undefined : payload.sub;
    } catch {
      throw new AppError(401, 'Invalid or expired token');
    }
    if (!userId) throw new AppError(401, 'Invalid or expired token');

    // Checked on every request so deactivating a user or changing a role takes effect immediately
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, isActive: true } });
    if (!user?.isActive) throw new AppError(401, 'Invalid or expired token');
    if (roles.length > 0 && !roles.includes(user.role)) throw new AppError(403, 'You do not have permission for this action');

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  });
