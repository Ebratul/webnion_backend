import type { Request, Response } from 'express';
import { agentEvents, agentFetch, AgentError } from '../../lib/agent.js';
import type { Locale } from '../../interfaces/index.js';
import { AppError } from '../../utils/AppError.js';
import { SiteSettingService } from '../site-setting/site-setting.service.js';
import { AiDocuments } from './ai.documents.js';
import { langsmithConfig, modelConfig, retrievalConfig } from './ai.payload.js';
import { AiSettings, slotReady, type AiSettingsValue } from './ai.settings.js';
import { AiUsage } from './ai.usage.js';

type Audience = 'public' | 'admin';

const BUSY: Record<Locale, string> = {
  en: 'The assistant is busy right now. Please try again in a moment, or reach us on WhatsApp or through the contact form.',
  bn: 'অ্যাসিস্ট্যান্ট এই মুহূর্তে ব্যস্ত। একটু পরে আবার চেষ্টা করুন, অথবা WhatsApp বা কন্টাক্ট ফর্মে যোগাযোগ করুন।',
};
const DAILY_LIMIT: Record<Locale, string> = {
  en: "You've reached today's message limit. Please contact us on WhatsApp or through the contact form.",
  bn: 'আজকের মেসেজের সীমা শেষ। অনুগ্রহ করে WhatsApp বা কন্টাক্ট ফর্মে যোগাযোগ করুন।',
};

export const chatAvailable = (value: AiSettingsValue, audience: Audience) =>
  value.enabled && value.features.siteQa && slotReady(value, 'chat') && (audience === 'public' ? value.showOnSite : value.showInAdmin);

// What the website needs to show the chat button. Nothing secret.
const publicConfig = async (locale: Locale, audience: Audience) => {
  const value = await AiSettings.load();
  const available = chatAvailable(value, audience);
  return {
    available,
    inquiry: available && value.features.chatInquiry && value.models.chat.tested?.tools !== false,
    name: value.assistant.name[locale] || value.assistant.name.en,
    greeting: value.assistant.greeting[locale] || value.assistant.greeting.en,
    suggestions: value.assistant.suggestions[locale]?.length ? value.assistant.suggestions[locale] : value.assistant.suggestions.en,
  };
};

const assistantSettings = async (value: AiSettingsValue, locale: Locale, audience: Audience) => {
  const site = await SiteSettingService.get().catch(() => null);
  const contact = site?.contact ?? {};
  return {
    site_name: String(site?.brand?.siteName || 'Webnion').slice(0, 60),
    name: (value.assistant.name[locale] || value.assistant.name.en).slice(0, 60),
    tone: value.assistant.tone,
    // Staff in the admin panel have no use for the inquiry form
    allow_inquiry: audience === 'public' && value.features.chatInquiry,
    max_output_tokens: value.limits.maxReplyTokens,
    contact: {
      email: contact.email ?? '',
      phone: contact.phoneBdLabel ?? '',
      whatsapp: contact.whatsappNumber ?? '',
      contact_url: `/${locale}/contact`,
    },
  };
};

const send = (res: Response, event: Record<string, unknown>) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// Streams the assistant's answer to the browser as Server-Sent Events: token, sources, inquiry, error and done.
// Provider details never reach the browser; usage is counted here.
const stream = async (req: Request, res: Response, audience: Audience) => {
  const { locale, messages } = req.body as { locale: Locale; messages: { role: 'user' | 'assistant'; content: string }[] };
  const value = await AiSettings.load();
  if (!chatAvailable(value, audience)) throw new AppError(404, 'The assistant is not available');
  const feature = audience === 'public' ? 'chat' : 'chat-admin';

  if (audience === 'public') {
    if ((await AiUsage.countToday('chat')) >= value.limits.publicMessagesPerDay) throw new AppError(429, BUSY[locale]);
    // req.ip, not the forwarded header the admin proxy sets: anyone can send that header, so it must not decide limits
    if (!(await AiUsage.takeVisitorMessage(req.ip, value.limits.messagesPerVisitorPerDay))) throw new AppError(429, DAILY_LIMIT[locale]);
  }

  const payload = {
    locale,
    audience,
    messages,
    chat_model: modelConfig(value, 'chat'),
    retrieval: await retrievalConfig(value, AiDocuments.cachedForChat),
    assistant: await assistantSettings(value, locale, audience),
    langsmith: langsmithConfig(value),
  };

  // Stops the AI service when the visitor closes the chat
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let usage = { inputTokens: 0, outputTokens: 0 };
  let failed = false;
  try {
    const response = await agentFetch('/v1/chat', payload, { timeoutMs: 90_000, signal: abort.signal });
    for await (const event of agentEvents(response)) {
      if (event.type === 'token' && typeof event.text === 'string') send(res, { type: 'token', text: event.text });
      else if (event.type === 'sources' && Array.isArray(event.items)) send(res, { type: 'sources', items: event.items.slice(0, 3) });
      else if (event.type === 'inquiry' && audience === 'public' && value.features.chatInquiry) send(res, { type: 'inquiry', proposal: event.proposal });
      else if (event.type === 'usage') usage = { inputTokens: Number(event.input_tokens) || 0, outputTokens: Number(event.output_tokens) || 0 };
      else if (event.type === 'error') {
        failed = true;
        console.error('AI chat error', event.code);
        send(res, { type: 'error', message: audience === 'admin' ? String(event.message ?? BUSY[locale]) : BUSY[locale] });
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      failed = true;
      console.error('AI chat failed', (error as Error).message);
      send(res, { type: 'error', message: audience === 'admin' && error instanceof AgentError ? error.message : BUSY[locale] });
    }
  }
  await AiUsage.record(feature, { ...usage, error: failed });
  send(res, { type: 'done' });
  res.end();
};

export const AiChat = { publicConfig, stream };
