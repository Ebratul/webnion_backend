import { createContentRouter } from '../../utils/content.js';
import { ProductController } from './product.controller.js';
import { ProductValidation } from './product.validation.js';

export const ProductRouter = createContentRouter(ProductController, ProductValidation);
