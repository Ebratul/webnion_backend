import type { z } from 'zod';
import type { InquiryValidation } from './inquiry.validation.js';

export type CreateInquiryInput = z.infer<typeof InquiryValidation.create>;
export type UpdateInquiryInput = z.infer<typeof InquiryValidation.update>;
