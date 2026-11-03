import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validateRequest =
  (schemas: { body?: ZodType; params?: ZodType }): RequestHandler =>
  (req, _res, next) => {
    if (schemas.params) schemas.params.parse(req.params);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  };
