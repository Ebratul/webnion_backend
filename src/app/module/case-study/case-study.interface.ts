import type { ContentBlock, Locale } from '../../interfaces/index.js';

export interface PublicCaseStudy {
  id: string;
  slug: string;
  title: string;
  category: string;
  image: string;
  publishedAt: Date | null;
  excerpt: string;
}

export interface PublicCaseStudyDetail extends PublicCaseStudy {
  content: ContentBlock[];
  contentLocale: Locale;
}
