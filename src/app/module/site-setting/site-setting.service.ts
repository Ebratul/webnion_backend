import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

export interface SiteSettings {
  contact: Record<string, string> | null;
  images: Record<string, string> | null;
  text: { en: Record<string, string>; bn: Record<string, string> };
}

// Anything never saved is left out, so the website falls back to its built-in value
const get = async (): Promise<SiteSettings> => {
  const rows = await prisma.siteSetting.findMany();
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  return {
    contact: (value('contact') as SiteSettings['contact']) ?? null,
    images: (value('images') as SiteSettings['images']) ?? null,
    text: (value('text') as SiteSettings['text']) ?? { en: {}, bn: {} },
  };
};

const update = async (input: Partial<Record<'contact' | 'images' | 'text', Prisma.InputJsonValue>>) => {
  await prisma.$transaction(
    Object.entries(input).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value: value! }, create: { key, value: value! } }),
    ),
  );
  return get();
};

export const SiteSettingService = { get, update };
