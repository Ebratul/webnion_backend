import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

export const InquiryValidation = {
  create: z.strictObject({
    name: z.string().trim().min(2, 'Name is too short').max(100),
    email: z.email('Enter a valid email address').trim().toLowerCase().max(200),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s()-]{6,18}$/, 'Enter a valid phone number'),
    company: optionalText(150),
    service: optionalText(150),
    message: z.string().trim().min(10, 'Please add a little more detail').max(2000),
    locale: z.enum(['en', 'bn']).default('en'),
    // Honeypot: hidden from people, filled in by bots
    website: z.string().max(200).optional(),
  }),
  update: z.strictObject({
    status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
};
