import type { Prisma } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

export interface SiteSettings {
  contact: Record<string, string> | null;
  images: Record<string, string> | null;
  brand: Record<string, string | null> | null;
  homepage: { hidden: string[] } | null;
  navigation: Record<string, unknown> | null;
  options: { whatsappButton: boolean; inquiryEmails: string[]; budgets: unknown[] } | null;
  text: { en: Record<string, string>; bn: Record<string, string> };
}

// Anything never saved is left out, so the website falls back to its built-in value
const get = async (): Promise<SiteSettings> => {
  const rows = await prisma.siteSetting.findMany();
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  return {
    contact: (value('contact') as SiteSettings['contact']) ?? null,
    images: (value('images') as SiteSettings['images']) ?? null,
    brand: (value('brand') as SiteSettings['brand']) ?? null,
    homepage: (value('homepage') as SiteSettings['homepage']) ?? null,
    navigation: (value('navigation') as SiteSettings['navigation']) ?? null,
    options: (value('options') as SiteSettings['options']) ?? null,
    text: (value('text') as SiteSettings['text']) ?? { en: {}, bn: {} },
  };
};

const update = async (input: Partial<Record<'contact' | 'images' | 'brand' | 'homepage' | 'navigation' | 'options' | 'text', Prisma.InputJsonValue>>) => {
  await prisma.$transaction(
    Object.entries(input).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value: value! }, create: { key, value: value! } }),
    ),
  );
  return get();
};

// Where inquiry emails go: the addresses set in the admin panel, or INQUIRY_NOTIFY_TO until then
const inquiryRecipients = async () => {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'options' } });
  const emails = (row?.value as { inquiryEmails?: string[] } | null)?.inquiryEmails;
  return emails?.length ? emails : undefined;
};

export const SiteSettingService = { get, update, inquiryRecipients };
