import type { Role } from '../../generated/prisma/client.js';

export type Locale = 'en' | 'bn';

export type LocalizedText = Record<Locale, string>;

export interface AuthUser {
  id: string;
  role: Role;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: { path: string; message: string }[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
