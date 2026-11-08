import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './app/config/index.js';
import { activityTrail } from './app/middleware/activityTrail.js';
import { globalErrorHandler } from './app/middleware/globalErrorHandler.js';
import { notFound } from './app/middleware/notFound.js';
import { apiLimiter } from './app/middleware/rateLimiter.js';
import { router } from './app/routes/index.js';

export const app = express();

app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
// Long case studies with a Bangla translation can reach several hundred kilobytes
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK' });
});

app.use('/uploads', express.static(config.uploadDir, { dotfiles: 'ignore', index: false, maxAge: '30d', immutable: true }));

app.use('/api/v1', apiLimiter, activityTrail, router);

app.use(notFound);
app.use(globalErrorHandler);
