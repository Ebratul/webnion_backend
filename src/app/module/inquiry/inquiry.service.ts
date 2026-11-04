import { config } from '../../config/index.js';
import { sendMail } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { inquiryNotificationTemplate } from '../../templates/inquiry.template.js';
import type { CreateInquiryInput, UpdateInquiryInput } from './inquiry.interface.js';

const create = async ({ website, ...data }: CreateInquiryInput) => {
  // Bots get the normal success response and nothing is stored
  if (website) return;

  const inquiry = await prisma.inquiry.create({ data });

  // The inquiry is already saved, so a mail failure must not fail the request
  void sendMail({
    to: config.INQUIRY_NOTIFY_TO,
    replyTo: inquiry.email,
    subject: `New project inquiry from ${(inquiry.name || inquiry.email).replace(/[\r\n]+/g, ' ')}`,
    html: inquiryNotificationTemplate(inquiry),
  }).catch((error) => console.error('Inquiry email failed', error));
};

const list = () => prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' } });

const update = (id: string, data: UpdateInquiryInput) => prisma.inquiry.update({ where: { id }, data });

export const InquiryService = { create, list, update };
