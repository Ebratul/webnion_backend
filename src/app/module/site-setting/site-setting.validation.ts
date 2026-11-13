import { z } from 'zod';
import { assetSchema, httpUrlSchema, localizedTextSchema } from '../../utils/validators.js';

const phone = z.string().trim().regex(/^\+?[\d\s-]{6,24}$/, 'Use digits, spaces and dashes only');

const contact = z.strictObject({
  email: z.email().max(200),
  phoneLocal: phone,
  phoneBdLabel: phone,
  // The second phone may be left empty, and is then not shown
  phoneItLabel: z.union([phone, z.literal('')]),
  whatsappNumber: phone,
  facebook: httpUrlSchema,
  instagram: httpUrlSchema,
  privacy: httpUrlSchema,
});

const images = z.strictObject({
  outcomeFounder: assetSchema,
  outcomeHandover: assetSchema,
  outcomeTeam: assetSchema,
  serviceContactCard: assetSchema,
  servicesClosingPreview: assetSchema,
  // The picture in the homepage's Problems card. Optional, so settings saved before it existed stay valid.
  problems: assetSchema.optional(),
});

// Name, logos and colour. The colour must be a six-digit hex so it can go straight into the site's stylesheet.
const brand = z.strictObject({
  siteName: z.string().trim().min(1).max(40),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #8224E3').transform((value) => value.toLowerCase()),
  logoOnDark: assetSchema,
  logoOnLight: assetSchema,
  favicon: assetSchema.nullable(),
  shareImage: assetSchema.nullable(),
  defaultTheme: z.enum(['dark', 'light']),
});

// A page on the site (/contact), a homepage section (#pricing), or a full address. A protocol-relative //address is refused.
const linkHref = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^(#[\w-]+|\/(?!\/)\S*|https?:\/\/\S+|mailto:\S+|tel:\+?[\d\s-]+)$/.test(value), 'Use /page, #section or a full address starting with https://');

const link = z.strictObject({ label: localizedTextSchema, href: linkHref });

export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'linkedin', 'youtube', 'x', 'tiktok', 'whatsapp', 'telegram', 'messenger', 'pinterest', 'threads', 'github', 'behance', 'dribbble', 'website'] as const;

// The header menu, the footer's link columns, social links and offices
const navigation = z.strictObject({
  header: z.array(link).max(12),
  headerButton: z.strictObject({ href: linkHref }),
  footerQuick: z.array(link).max(20),
  // The footer's Company column: brands and company pages. Optional, so menus saved before it stay valid.
  footerCompany: z.array(link).max(20).optional(),
  footerServices: z.array(link).max(20),
  socials: z.array(z.strictObject({ network: z.enum(SOCIAL_NETWORKS), url: httpUrlSchema })).max(15),
  offices: z.array(z.strictObject({ name: localizedTextSchema, address: localizedTextSchema })).max(8),
});

// Site behaviour: the floating WhatsApp button, who gets inquiry emails, and the budget choices in the inquiry forms
const options = z.strictObject({
  whatsappButton: z.boolean(),
  inquiryEmails: z.array(z.email().max(200)).min(1).max(10),
  budgets: z.array(localizedTextSchema).min(1).max(15),
  // Prices are set in dollars. The Bangla site can show them in Taka at this rate, rounded to the nearest roundTo.
  takaPrices: z
    .strictObject({
      showTakaInBangla: z.boolean(),
      usdToBdt: z.number().positive('The rate must be above 0').max(1000),
      roundTo: z.union([z.literal(1), z.literal(10), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]),
    })
    .optional(),
});

// Homepage sections the admin has hidden, by name, such as "process"
// The Pricing page's lists: what every plan includes, the steps after booking, and the other services offered
const pricingPage = z.strictObject({
  included: z.array(localizedTextSchema).max(10),
  steps: z.array(z.strictObject({ title: localizedTextSchema, text: localizedTextSchema })).min(1).max(6),
  extras: z.array(localizedTextSchema).max(40),
});

const homepage = z.strictObject({
  hidden: z.array(z.string().regex(/^[a-zA-Z]{1,40}$/)).max(30),
});

// Each entry replaces one piece of the site's built-in text. The path says which, such as hero.titleLines.0
const textOverrides = z.record(z.string().regex(/^[\w.]{1,120}$/), z.string().trim().min(1).max(5000));

const update = z
  .strictObject({
    contact: contact.optional(),
    images: images.optional(),
    brand: brand.optional(),
    homepage: homepage.optional(),
    navigation: navigation.optional(),
    options: options.optional(),
    pricingPage: pricingPage.optional(),
    text: z.strictObject({ en: textOverrides, bn: textOverrides }).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const SiteSettingValidation = { update };
