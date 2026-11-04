import { catchAsync } from '../../utils/catchAsync.js';
import { createContentController } from '../../utils/content.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { ProductService } from './product.service.js';
import { ProductValidation } from './product.validation.js';

export const ProductController = {
  ...createContentController(ProductService, 'Products'),
  listPublic: catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Products retrieved', await ProductService.search(getLocale(req), ProductValidation.search.parse(req.query)));
  }),
};
