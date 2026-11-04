import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { auth } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { UploadService, receiveFile } from './upload.service.js';

const receive: RequestHandler = (req, res, next) => {
  receiveFile(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'Files can be at most 300 MB' : 'Upload one file at a time'));
      return;
    }
    next(error);
  });
};

export const UploadRouter = Router();

UploadRouter.post(
  '/',
  auth(),
  receive,
  catchAsync(async (req, res) => {
    if (!req.file) throw new AppError(400, 'Choose a file to upload');
    sendResponse(res, 201, 'File uploaded', await UploadService.store(req.file.path));
  }),
);
