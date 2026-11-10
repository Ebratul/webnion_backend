import { isIP } from 'node:net';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';

// The admin panel calls this API from its own server, so req.ip is that server. It passes on the visitor's address in
// this header. Someone calling the API directly could fake it, so it is for reading the log only and never for security.
export const clientIp = (req: Request) => {
  const forwarded = req.get('x-webnion-client-ip')?.trim();
  return forwarded && isIP(forwarded) ? forwarded : req.ip;
};

export const ACTIVITY_ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'REORDER', 'UPLOAD', 'INQUIRY'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityEntry {
  // Set only to collapse a burst of events into one row: a repeated id is ignored
  id?: string;
  action: ActivityAction;
  resource?: string;
  resourceId?: string;
  summary: string;
  details?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  ip?: string;
}

// A log that cannot be written must never fail the action it describes
const record = async (entry: ActivityEntry) => {
  try {
    await prisma.activityLog.createMany({ data: [entry], skipDuplicates: true });
  } catch (error) {
    console.error('Activity log failed', error);
  }
};

interface ListQuery {
  page: number;
  limit: number;
  action?: ActivityAction | undefined;
  q?: string | undefined;
}

const list = async ({ page, limit, action, q }: ListQuery) => {
  // MySQL's default collation already matches without regard to case
  const where = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q } },
            { actorName: { contains: q } },
            { actorEmail: { contains: q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.activityLog.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(Math.ceil(total / limit), 1) };
};

export const ActivityLogService = { record, list };
