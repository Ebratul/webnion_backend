import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import type { ApiResponse } from '../interfaces/index.js';
import { AppError } from '../utils/AppError.js';

const prismaStatus: Record<string, [number, string]> = {
  P2002: [409, 'A record with this value already exists'],
  P2025: [404, 'Record not found'],
};

export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  const body: ApiResponse<never> = { success: false, message: 'Something went wrong. Please try again.' };

  if (err instanceof ZodError) {
    status = 400;
    body.message = 'Please check the highlighted fields';
    body.errors = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (err instanceof AppError) {
    status = err.statusCode;
    body.message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && prismaStatus[err.code]) {
    [status, body.message] = prismaStatus[err.code]!;
  } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    // Raised by body-parser for malformed JSON or oversized payloads
    status = err.status;
    body.message = status === 413 ? 'Request is too large' : 'Request could not be read';
  } else {
    console.error(err);
  }

  res.status(status).json(body);
};
