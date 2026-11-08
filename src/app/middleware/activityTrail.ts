import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { ActivityLogService, type ActivityEntry } from '../module/activity-log/activity-log.service.js';

interface Named {
  findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
}

// Everything the admin panel can change. Adding a content section means adding it here too.
const TRACKED: Record<string, { label: string; model?: Named }> = {
  projects: { label: 'Projects', model: prisma.project as unknown as Named },
  products: { label: 'Products', model: prisma.product as unknown as Named },
  'case-studies': { label: 'Case Studies', model: prisma.caseStudy as unknown as Named },
  testimonials: { label: 'Customer Reviews', model: prisma.testimonial as unknown as Named },
  services: { label: 'Services', model: prisma.service as unknown as Named },
  'pricing-plans': { label: 'Pricing', model: prisma.pricingPlan as unknown as Named },
  'hero-backgrounds': { label: 'Hero Background', model: prisma.heroBackground as unknown as Named },
  faqs: { label: 'FAQs', model: prisma.faq as unknown as Named },
  team: { label: 'Team', model: prisma.teamMember as unknown as Named },
  clients: { label: 'Client Logos', model: prisma.clientLogo as unknown as Named },
  'delivery-stories': { label: 'Delivery Stories', model: prisma.deliveryStory as unknown as Named },
  'outcome-cards': { label: 'Outcome Cards', model: prisma.outcomeCard as unknown as Named },
  technologies: { label: 'Technologies', model: prisma.technology as unknown as Named },
  inquiries: { label: 'Inquiries', model: prisma.inquiry as unknown as Named },
  users: { label: 'Users', model: prisma.user as unknown as Named },
  uploads: { label: 'Uploads' },
  'site-settings': { label: 'Site Settings' },
};

const UUID = /^[0-9a-f-]{36}$/i;
const REORDER_WINDOW_MS = 30_000;

const english = (value: unknown) => {
  if (typeof value === 'string') return value;
  const text = (value as { en?: unknown } | null | undefined)?.en;
  return typeof text === 'string' ? text : undefined;
};

const titleOf = (row: Record<string, unknown> | null | undefined) =>
  row ? (english(row.title) ?? english(row.name) ?? english(row.question) ?? (row.email as string | undefined) ?? (row.slug as string | undefined)) : undefined;

// Only field names are kept. A password or a message never reaches the log.
const describe = (method: string, body: Record<string, unknown>, label: string, title: string | undefined): Pick<ActivityEntry, 'action' | 'summary' | 'details'> => {
  const name = title ? `"${title}"` : 'an item';
  if (method === 'DELETE') return { action: 'DELETE', summary: `Deleted ${name} from ${label}` };
  if (method === 'POST') return { action: 'CREATE', summary: `Added ${name} to ${label}` };

  const fields = Object.keys(body);
  if (fields.length === 1 && fields[0] === 'isActive') return { action: 'UPDATE', summary: `${body.isActive ? 'Showed' : 'Hid'} ${name} in ${label}` };
  if (fields.length === 1 && fields[0] === 'status') return { action: 'UPDATE', summary: `Marked ${name} as ${String(body.status).toLowerCase()}` };
  return { action: 'UPDATE', summary: `Updated ${name} in ${label}`, details: `Changed: ${fields.join(', ')}` };
};

// Writes one log row for each successful change. The row is saved before the response goes out, because a
// serverless function can be frozen the moment it has answered.
export const activityTrail: RequestHandler = async (req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  const [segment, id] = req.path.split('/').filter(Boolean);
  const tracked = segment ? TRACKED[segment] : undefined;
  if (!tracked) {
    next();
    return;
  }

  // A deleted record is gone by the time the response is written, so its name is read first
  const before = req.method === 'DELETE' && id && UUID.test(id) ? await tracked.model?.findUnique({ where: { id } }).catch(() => null) : undefined;
  const send = res.json.bind(res);

  res.json = (payload: { data?: Record<string, unknown> }) => {
    // Anonymous requests are left alone here: a new inquiry is recorded where it is saved
    if (res.statusCode >= 400 || !req.user) return send(payload);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const who = { actorId: req.user.id, actorName: req.user.name, actorEmail: req.user.email, ip: req.ip, resource: segment! };
    const actor = { ...who, ...(id ? { resourceId: id } : {}) };
    let entry: ActivityEntry;

    if (segment === 'uploads') {
      entry = { ...actor, action: 'UPLOAD', summary: `Uploaded ${payload.data?.kind === 'image' ? 'an image' : 'a video'}`, details: String(payload.data?.path ?? '') };
    } else if (segment === 'site-settings') {
      entry = { ...actor, action: 'UPDATE', summary: `Updated ${Object.keys(body).join(' and ')} settings`, details: Object.entries((body.text ?? {}) as Record<string, object>).map(([language, values]) => `${language}: ${Object.keys(values).length} custom texts`).join(', ') };
    } else if (req.method === 'PATCH' && Object.keys(body).length === 1 && 'sortOrder' in body) {
      // Moving one row renumbers many. They share an id for a few seconds, so the burst becomes one line.
      const bucket = Math.floor(Date.now() / REORDER_WINDOW_MS);
      entry = { ...who, id: `reorder-${segment}-${req.user.id}-${bucket}`, action: 'REORDER', summary: `Changed the order of ${tracked.label}` };
    } else {
      entry = { ...actor, ...describe(req.method, body, tracked.label, titleOf(payload.data) ?? titleOf(before)) };
    }

    void ActivityLogService.record(entry).finally(() => send(payload));
    return res;
  };

  next();
};
