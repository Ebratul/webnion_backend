import type { Role } from '../../generated/prisma/client.js';

export type Locale = 'en' | 'bn';

export type LocalizedText = Record<Locale, string>;

export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'image'; src: string; alt?: string };

export interface LocalizedContent {
  blocks: ContentBlock[];
  // The locale the blocks are actually written in, which differs from the request when a translation is missing
  locale: Locale;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
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
