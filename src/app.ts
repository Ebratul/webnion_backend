import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './app/config/index.js';
import { globalErrorHandler } from './app/middleware/globalErrorHandler.js';
import { notFound } from './app/middleware/notFound.js';
import { apiLimiter } from './app/middleware/rateLimiter.js';
import { router } from './app/routes/index.js';

export const app = express();

app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK' });
});

app.use('/api/v1', apiLimiter, router);

app.use(notFound);
app.use(globalErrorHandler);
