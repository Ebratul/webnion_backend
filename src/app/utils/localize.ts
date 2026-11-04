import type { Request } from 'express';
import type { ContentBlock, Locale, LocalizedContent, LocalizedText } from '../interfaces/index.js';

export const getLocale = (req: Request): Locale => (req.query.locale === 'bn' ? 'bn' : 'en');

export const pickText = (value: unknown, locale: Locale): string => {
  const text = value as Partial<LocalizedText> | null;
  return text?.[locale] ?? text?.en ?? '';
};

export const pickOptionalText = (value: unknown, locale: Locale): string | null => pickText(value, locale) || null;

export const pickContent = (value: unknown, locale: Locale): LocalizedContent => {
  const content = value as Partial<Record<Locale, ContentBlock[]>> | null;
  const translated = content?.[locale];
  if (translated?.length) return { blocks: translated, locale };
  return { blocks: content?.en ?? [], locale: 'en' };
};
