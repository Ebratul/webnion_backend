import { createContentController } from '../../utils/content.js';
import { TestimonialService } from './testimonial.service.js';

export const TestimonialController = createContentController(TestimonialService, 'Testimonials');
