import { createContentRouter } from '../../utils/content.js';
import { HeroBackgroundController } from './hero-background.controller.js';
import { HeroBackgroundValidation } from './hero-background.validation.js';

export const HeroBackgroundRouter = createContentRouter(HeroBackgroundController, HeroBackgroundValidation);
