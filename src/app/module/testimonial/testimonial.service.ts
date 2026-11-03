import type { Testimonial as TestimonialRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicTestimonial } from './testimonial.interface.js';

export const TestimonialService = createContentService<TestimonialRow, PublicTestimonial>(prisma.testimonial, (row, locale) => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  role: pickText(row.role, locale),
  avatar: row.avatar,
  image: row.image,
  videoUrl: row.videoUrl,
}));
