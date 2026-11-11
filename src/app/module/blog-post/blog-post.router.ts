import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { getLocale } from '../../utils/localize.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { idParamSchema, slugParamSchema } from '../../utils/validators.js';
import { BlogPostService } from './blog-post.service.js';
import { BlogPostValidation } from './blog-post.validation.js';

export const BlogPostRouter = Router();

BlogPostRouter.get(
  '/',
  catchAsync(async (req, res) => {
    const { tag } = BlogPostValidation.list.parse(req.query);
    sendResponse(res, 200, 'Posts retrieved', await BlogPostService.listPublic(getLocale(req), tag));
  }),
);
BlogPostRouter.get(
  '/all',
  auth(),
  catchAsync(async (_req, res) => {
    sendResponse(res, 200, 'Posts retrieved', await BlogPostService.listAll());
  }),
);
BlogPostRouter.get(
  '/id/:id',
  auth(),
  validateRequest({ params: idParamSchema }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Post retrieved', await BlogPostService.getById(req.params.id as string));
  }),
);
BlogPostRouter.get(
  '/:slug',
  validateRequest({ params: slugParamSchema }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Post retrieved', await BlogPostService.getPublicBySlug(req.params.slug as string, getLocale(req)));
  }),
);
BlogPostRouter.post(
  '/',
  auth(),
  validateRequest({ body: BlogPostValidation.create }),
  catchAsync(async (req, res) => {
    sendResponse(res, 201, 'Post created', await BlogPostService.create({ authorName: req.user?.name, ...req.body }));
  }),
);
BlogPostRouter.patch(
  '/:id',
  auth(),
  validateRequest({ params: idParamSchema, body: BlogPostValidation.update }),
  catchAsync(async (req, res) => {
    sendResponse(res, 200, 'Post updated', await BlogPostService.update(req.params.id as string, req.body));
  }),
);
BlogPostRouter.delete(
  '/:id',
  auth(),
  validateRequest({ params: idParamSchema }),
  catchAsync(async (req, res) => {
    await BlogPostService.remove(req.params.id as string);
    sendResponse(res, 200, 'Post deleted');
  }),
);
