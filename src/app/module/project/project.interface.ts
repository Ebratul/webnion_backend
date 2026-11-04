import type { ContentBlock, Locale } from '../../interfaces/index.js';

export interface PublicProject {
  id: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  url: string | null;
  isFeatured: boolean;
}

export interface PublicProjectDetail extends PublicProject {
  client: string | null;
  budget: string | null;
  location: string | null;
  sector: string | null;
  completedAt: Date | null;
  content: ContentBlock[];
  contentLocale: Locale;
}
