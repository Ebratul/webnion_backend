import type { Request } from 'express';
import type { Locale, LocalizedText } from '../interfaces/index.js';

export const getLocale = (req: Request): Locale => (req.query.locale === 'bn' ? 'bn' : 'en');

export const pickText = (value: unknown, locale: Locale): string => {
  const text = value as Partial<LocalizedText> | null;
  return text?.[locale] ?? text?.en ?? '';
};
