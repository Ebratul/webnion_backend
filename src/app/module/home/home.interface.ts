import type { PublicClient } from '../client/client.interface.js';
import type { PublicDeliveryStory } from '../delivery-story/delivery-story.interface.js';
import type { PublicFaq } from '../faq/faq.interface.js';
import type { PublicPricing } from '../pricing/pricing.interface.js';
import type { PublicProject } from '../project/project.interface.js';
import type { PublicService } from '../service/service.interface.js';
import type { PublicTeam } from '../team/team.interface.js';
import type { PublicTestimonial } from '../testimonial/testimonial.interface.js';

export interface HomePayload {
  services: PublicService[];
  projects: PublicProject[];
  testimonials: PublicTestimonial[];
  deliveryStories: PublicDeliveryStory[];
  pricingPlans: PublicPricing[];
  faqs: PublicFaq[];
  team: PublicTeam[];
  clients: PublicClient[];
}
