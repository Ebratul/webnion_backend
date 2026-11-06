import type { Locale } from '../../interfaces/index.js';
import { CaseStudyService } from '../case-study/case-study.service.js';
import { ClientService } from '../client/client.service.js';
import { DeliveryStoryService } from '../delivery-story/delivery-story.service.js';
import { FaqService } from '../faq/faq.service.js';
import { HeroBackgroundService } from '../hero-background/hero-background.service.js';
import { OutcomeCardService } from '../outcome-card/outcome-card.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { ProjectService } from '../project/project.service.js';
import { ServiceService } from '../service/service.service.js';
import { TeamService } from '../team/team.service.js';
import { TestimonialService } from '../testimonial/testimonial.service.js';
import type { HomePayload } from './home.interface.js';

const getHome = async (locale: Locale): Promise<HomePayload> => {
  const [heroBackgrounds, services, projects, caseStudies, testimonials, deliveryStories, outcomeCards, pricingPlans, faqs, team, clients] = await Promise.all([
    HeroBackgroundService.listPublic(locale),
    ServiceService.listPublic(locale),
    ProjectService.listPublic(locale),
    CaseStudyService.listPublic(locale),
    TestimonialService.listPublic(locale),
    DeliveryStoryService.listPublic(locale),
    OutcomeCardService.listPublic(locale),
    PricingService.listPublic(locale),
    FaqService.listPublic(locale),
    TeamService.listPublic(locale),
    ClientService.listPublic(locale),
  ]);

  return { heroBackground: heroBackgrounds[0]?.image ?? null, services, projects, caseStudies, testimonials, deliveryStories, outcomeCards, pricingPlans, faqs, team, clients };
};

export const HomeService = { getHome };
