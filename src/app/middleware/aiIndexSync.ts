import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from 'express';
import { AiIndex } from '../module/ai/ai.index.js';

// Content the AI assistant answers from. A change to any of these updates the search index.
const CONTENT = new Set(['services', 'projects', 'products', 'case-studies', 'faqs', 'pricing-plans', 'team', 'technologies', 'blog-posts', 'site-settings']);

// After an admin's change succeeds, the index is updated in the background. waitUntil keeps a Vercel function awake for it.
export const aiIndexSync: RequestHandler = (req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  const segment = req.path.split('/').filter(Boolean)[0];
  if (!segment || !CONTENT.has(segment)) {
    next();
    return;
  }
  res.on('finish', () => {
    if (res.statusCode < 400 && req.user) waitUntil(AiIndex.syncSoon());
  });
  next();
};
