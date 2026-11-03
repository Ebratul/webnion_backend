import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const transporter = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export const sendMail = async (mail: { to: string; subject: string; html: string; replyTo?: string }) => {
  if (!transporter) return false;
  await transporter.sendMail({ from: config.MAIL_FROM, ...mail });
  return true;
};
