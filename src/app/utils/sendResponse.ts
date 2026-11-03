import type { Response } from 'express';
import type { ApiResponse } from '../interfaces/index.js';

export const sendResponse = <T>(res: Response, statusCode: number, message: string, data?: T) => {
  const body: ApiResponse<T> = { success: true, message, data };
  res.status(statusCode).json(body);
};
