import { createContentController } from '../../utils/content.js';
import { HeroBackgroundService } from './hero-background.service.js';

export const HeroBackgroundController = createContentController(HeroBackgroundService, 'Hero backgrounds');
