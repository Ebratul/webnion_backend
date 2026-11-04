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

export const config = {
  ...parsed.data,
  cloudinary: cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret, folder } : null,
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
