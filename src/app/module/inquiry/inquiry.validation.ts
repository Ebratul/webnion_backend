import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

// The contact page only requires an email, so these may be blank, but must be valid when filled in
const blankOr = (schema: z.ZodString) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.union([z.literal(''), schema]).default(''));

export const InquiryValidation = {
  create: z.strictObject({
    name: blankOr(z.string().min(2, 'Name is too short').max(100)),
    email: z.email('Enter a valid email address').trim().toLowerCase().max(200),
    phone: blankOr(z.string().regex(/^\+?[0-9][0-9\s()-]{6,18}$/, 'Enter a valid phone number')),
    company: optionalText(150),
    service: optionalText(150),
    budget: optionalText(60),
    country: optionalText(100),
    existingWebsite: optionalText(300),
    message: blankOr(z.string().min(10, 'Please add a little more detail').max(2000)),
    locale: z.enum(['en', 'bn']).default('en'),
    // Where the visitor sent it from: the form, or the chat assistant after they checked the details
    source: z.enum(['form', 'chat']).default('form'),
    // Honeypot: hidden from people, filled in by bots
    website: z.string().max(200).optional(),
  }),
  update: z.strictObject({
    status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  }),
};
