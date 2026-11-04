import type { ContentBlock, Locale } from '../../interfaces/index.js';

export interface PublicService {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

export interface PublicServiceDetail extends PublicService {
  content: ContentBlock[];
  contentLocale: Locale;
  faqs: ServiceFaq[];
  faqsLocale: Locale;
}
