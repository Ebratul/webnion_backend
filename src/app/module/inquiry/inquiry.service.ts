import { waitUntil } from '@vercel/functions';
import { config } from '../../config/index.js';
import { sendMail } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { inquiryNotificationTemplate } from '../../templates/inquiry.template.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { SiteSettingService } from '../site-setting/site-setting.service.js';
import type { CreateInquiryInput, UpdateInquiryInput } from './inquiry.interface.js';

const create = async ({ website, ...data }: CreateInquiryInput) => {
  // Bots get the normal success response and nothing is stored
  if (website) return;

  const inquiry = await prisma.inquiry.create({ data });
  await ActivityLogService.record({ action: 'INQUIRY', resource: 'inquiries', resourceId: inquiry.id, summary: `New inquiry from ${inquiry.name || inquiry.email}${inquiry.source === 'chat' ? ' (chat assistant)' : ''}`, actorName: 'Website visitor' });

  // The inquiry is already saved, so a mail failure must not fail the request. waitUntil keeps a Vercel function awake
  // until the email is sent; without it the function can be frozen as soon as it has answered.
  const recipients = (await SiteSettingService.inquiryRecipients().catch(() => undefined)) ?? [config.INQUIRY_NOTIFY_TO];
  waitUntil(
    sendMail({
      to: recipients.join(', '),
      replyTo: inquiry.email,
      subject: `New project inquiry from ${(inquiry.name || inquiry.email).replace(/[\r\n]+/g, ' ')}`,
      html: inquiryNotificationTemplate(inquiry),
    }).catch((error) => console.error('Inquiry email failed', error)),
  );
};

const list = () => prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' } });

const update = (id: string, data: UpdateInquiryInput) => prisma.inquiry.update({ where: { id }, data });

export const InquiryService = { create, list, update };
