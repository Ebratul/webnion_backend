import { Router, type RequestHandler } from 'express';
import type { ZodType } from 'zod';
import type { Locale } from '../interfaces/index.js';
import { auth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { catchAsync } from './catchAsync.js';
import { getLocale } from './localize.js';
import { sendResponse } from './sendResponse.js';
import { idParamSchema } from './validators.js';

// The content tables share one shape (isActive, sortOrder) and one set of operations, so each module
// supplies only its model, its localizer and its validation schemas.
interface ContentDelegate<Row> {
  findMany(args: { where?: { isActive: boolean }; orderBy: { sortOrder: 'asc' }[] }): Promise<Row[]>;
  create(args: { data: unknown }): Promise<Row>;
  update(args: { where: { id: string }; data: unknown }): Promise<Row>;
  delete(args: { where: { id: string } }): Promise<Row>;
}

export const createContentService = <Row, Public>(delegate: unknown, localize: (row: Row, locale: Locale) => Public) => {
  const model = delegate as ContentDelegate<Row>;
  const orderBy: { sortOrder: 'asc' }[] = [{ sortOrder: 'asc' }];

  return {
    listPublic: async (locale: Locale) => {
      const rows = await model.findMany({ where: { isActive: true }, orderBy });
      return rows.map((row) => localize(row, locale));
    },
    listAll: () => model.findMany({ orderBy }),
    create: (data: unknown) => model.create({ data }),
    update: (id: string, data: unknown) => model.update({ where: { id }, data }),
    remove: (id: string) => model.delete({ where: { id } }),
  };
};

interface ContentServiceLike {
  listPublic(locale: Locale): Promise<unknown>;
  listAll(): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown>;
  remove(id: string): Promise<unknown>;
}

export const createContentController = (service: ContentServiceLike, label: string) => ({
  listPublic: catchAsync(async (req, res) => {
    sendResponse(res, 200, `${label} retrieved`, await service.listPublic(getLocale(req)));
  }),
  listAll: catchAsync(async (_req, res) => {
    sendResponse(res, 200, `${label} retrieved`, await service.listAll());
  }),
  create: catchAsync(async (req, res) => {
    sendResponse(res, 201, `${label} created`, await service.create(req.body));
  }),
  update: catchAsync(async (req, res) => {
    sendResponse(res, 200, `${label} updated`, await service.update(req.params.id as string, req.body));
  }),
  remove: catchAsync(async (req, res) => {
    await service.remove(req.params.id as string);
    sendResponse(res, 200, `${label} deleted`);
  }),
});

interface ContentController {
  listPublic: RequestHandler;
  listAll: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export const createContentRouter = (
  controller: ContentController,
  schemas: { create: ZodType; update: ZodType },
) => {
  const router = Router();

  router.get('/', controller.listPublic);
  router.get('/all', auth(), controller.listAll);
  router.post('/', auth(), validateRequest({ body: schemas.create }), controller.create);
  router.patch('/:id', auth(), validateRequest({ params: idParamSchema, body: schemas.update }), controller.update);
  router.delete('/:id', auth(), validateRequest({ params: idParamSchema }), controller.remove);

  return router;
};
