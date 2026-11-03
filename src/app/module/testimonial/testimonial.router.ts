import { createContentRouter } from '../../utils/content.js';
import { TestimonialController } from './testimonial.controller.js';
import { TestimonialValidation } from './testimonial.validation.js';

export const TestimonialRouter = createContentRouter(TestimonialController, TestimonialValidation);
