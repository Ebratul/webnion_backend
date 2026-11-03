import { Router } from 'express';
import { HomeController } from './home.controller.js';

export const HomeRouter = Router();

HomeRouter.get('/', HomeController.getHome);
