import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ quiet: true });

// A key left blank in .env means the same as a key that is not there
const optionalEnv = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  // The PEM certificate of the database host's own authority, for hosts like Aiven. \\n in a one-line value is read as a line break.
  DATABASE_CA_CERT: optionalEnv,
  // Connections each running copy of the API may hold. Copies times this must stay under the host's limit.
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(20).default(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Webnion <hello@webnion.com>'),
  INQUIRY_NOTIFY_TO: z.string().default('hello@webnion.com'),
  UPLOAD_DIR: z.string().default('uploads'),
  CLOUDINARY_CLOUD_NAME: optionalEnv,
  CLOUDINARY_API_KEY: optionalEnv,
  CLOUDINARY_API_SECRET: optionalEnv,
  CLOUDINARY_FOLDER: z.string().trim().min(1).default('webnion'),
  // The Python AI service (webnion_rag_agent). Without these the AI features stay off.
  AGENT_URL: optionalEnv,
  AGENT_SHARED_SECRET: optionalEnv.refine((value) => !value || value.length >= 32, 'AGENT_SHARED_SECRET must be at least 32 characters'),
  // Encrypts the provider keys saved in AI Settings. At least 32 characters; changing it makes saved keys unreadable.
  AI_SECRETS_KEY: optionalEnv.refine((value) => !value || value.length >= 32, 'AI_SECRETS_KEY must be at least 32 characters'),
  // Vercel Cron sends it to the nightly search index check
  CRON_SECRET: optionalEnv,
  // Local testing only: allows the "fake" AI provider, which the AI service also refuses unless told otherwise
  AI_ALLOW_FAKE: z.enum(['0', '1']).default('0'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n  ');
  throw new Error(`Invalid environment variables:\n  ${details}`);
}

const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret, CLOUDINARY_FOLDER: folder } = parsed.data;
const cloudinaryKeysSet = [cloudName, apiKey, apiSecret].filter(Boolean).length;

// Half a setup would otherwise fail on the first upload, long after the deploy looked fine
if (cloudinaryKeysSet > 0 && cloudinaryKeysSet < 3) {
  throw new Error('Invalid environment variables:\n  Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or none of them');
}

const agentUrl = parsed.data.AGENT_URL?.replace(/\/+$/, '');
// Keys travel to the AI service, so outside local development it must be reached over https
if (agentUrl && parsed.data.NODE_ENV === 'production' && !agentUrl.startsWith('https://')) {
  throw new Error('Invalid environment variables:\n  AGENT_URL must start with https:// in production');
}

export const config = {
  ...parsed.data,
  agent: agentUrl && parsed.data.AGENT_SHARED_SECRET ? { url: agentUrl, secret: parsed.data.AGENT_SHARED_SECRET } : null,
  allowFakeAi: parsed.data.AI_ALLOW_FAKE === '1' && parsed.data.NODE_ENV !== 'production',
  cloudinary: cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret, folder } : null,
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
