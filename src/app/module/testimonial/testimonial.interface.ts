export interface PublicTestimonial {
  id: string;
  kind: 'VIDEO' | 'RESULT';
  name: string;
  role: string;
  avatar: string | null;
  image: string;
  videoUrl: string | null;
}
