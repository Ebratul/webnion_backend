import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

// Provider keys are stored as "v1.<iv>.<tag>.<ciphertext>", encrypted with AES-256-GCM. The slot name is bound in as
// additional data, so a stored key cannot be copied into another slot and used there.
const PREFIX = 'v1';

const key = () => {
  if (!config.AI_SECRETS_KEY) throw new AppError(503, 'AI_SECRETS_KEY is not set on the server, so keys cannot be saved');
  return createHash('sha256').update(config.AI_SECRETS_KEY).digest();
};

export const canEncrypt = () => Boolean(config.AI_SECRETS_KEY);

export const encryptSecret = (plain: string, slot: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(slot));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
};

// Returns undefined when the value cannot be read, for example after AI_SECRETS_KEY was changed
export const decryptSecret = (stored: string | undefined, slot: string): string | undefined => {
  if (!stored || !config.AI_SECRETS_KEY) return undefined;
  const [prefix, iv, tag, data] = stored.split('.');
  if (prefix !== PREFIX || !iv || !tag || !data) return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(slot));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
};
