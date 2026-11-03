import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const createLimiter = (limit: number, windowMinutes: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { success: false, message },
  });

export const apiLimiter = createLimiter(300, 15, 'Too many requests. Please try again shortly.');
export const loginLimiter = createLimiter(10, 15, 'Too many login attempts. Please try again in 15 minutes.');
export const inquiryLimiter = createLimiter(5, 15, 'Too many inquiries sent. Please try again in 15 minutes or message us on WhatsApp.');
