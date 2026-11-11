import { createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

export interface AgentEvent {
  type: string;
  [key: string]: unknown;
}

// Messages for the admin, by the AI service's error codes
const MESSAGES: Record<string, string> = {
  auth: 'The API key was refused. Check that it is correct and active.',
  model: 'The provider does not know this model name, or the key cannot use it.',
  rate_limit: "The provider's rate limit or quota was reached. Try again later or check the account's billing.",
  unavailable: 'The AI provider did not answer in time. Try again shortly.',
  loading: 'The model is still loading on Hugging Face. Try again in a minute.',
  unsafe_url: 'The base address must be a public https:// address.',
  not_supported: 'This provider or model cannot do this job.',
  content_filter: "The provider refused this request under its content rules.",
};

export class AgentError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(statusCode, message);
  }
}

export const agentErrorMessage = (code: string | undefined, fallback?: string) => fallback || MESSAGES[code ?? ''] || 'The AI service returned an error.';

const sign = (secret: string, timestamp: string, nonce: string, path: string, body: string) =>
  createHmac('sha256', secret).update(`${timestamp}.${nonce}.POST.${path}.${createHash('sha256').update(body).digest('hex')}`).digest('hex');

// Every call to the AI service is signed (see webnion_rag_agent/app/security.py). Keys travel only inside these requests.
export const agentFetch = async (path: string, payload: unknown, { timeoutMs = 60_000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}) => {
  if (!config.agent) throw new AgentError(503, 'The AI service is not connected. Set AGENT_URL and AGENT_SHARED_SECRET on the server.', 'not_connected');
  const url = new URL(`${config.agent.url}${path}`);
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(18).toString('base64url');
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webnion-Timestamp': timestamp,
        'X-Webnion-Nonce': nonce,
        'X-Webnion-Signature': sign(config.agent.secret, timestamp, nonce, url.pathname, body),
      },
      body,
      signal: AbortSignal.any(signals),
      redirect: 'error',
    });
  } catch (error) {
    if ((error as Error).name === 'TimeoutError') throw new AgentError(504, 'The AI service took too long to answer.', 'unavailable');
    if ((error as Error).name === 'AbortError') throw error;
    throw new AgentError(503, 'The AI service could not be reached.', 'unavailable');
  }

  if (response.status === 401) throw new AgentError(503, 'The AI service refused the request signature. Check that AGENT_SHARED_SECRET matches on both servers.', 'signature');
  if (response.status === 503) {
    const data = (await response.json().catch(() => ({}))) as { code?: string };
    if (data.code === 'not_configured') throw new AgentError(503, 'AGENT_SHARED_SECRET is not set on the AI service.', 'not_configured');
    throw new AgentError(503, 'The AI service is unavailable.', 'unavailable');
  }
  if (response.status === 422) {
    const data = (await response.json().catch(() => ({}))) as { problems?: { field: string; message: string }[] };
    const problem = data.problems?.[0];
    throw new AgentError(400, problem ? `The AI service refused the settings: ${problem.field} ${problem.message}`.trim() : 'The AI service refused the request.', 'invalid');
  }
  return response;
};

export const agentJson = async <T>(path: string, payload: unknown, options?: { timeoutMs?: number }): Promise<T> => {
  const response = await agentFetch(path, payload, options);
  const data = (await response.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (!response.ok) throw new AgentError(502, agentErrorMessage(data.code, data.message), data.code ?? 'error');
  return data;
};

// Reads the AI service's Server-Sent Events one at a time
export async function* agentEvents(response: Response): AsyncGenerator<AgentEvent> {
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new AgentError(502, agentErrorMessage(data.code, data.message), data.code ?? 'error');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf('\n\n');
      const data = block.split('\n').find((line) => line.startsWith('data: '));
      if (!data) continue;
      try {
        const event = JSON.parse(data.slice(6)) as AgentEvent;
        const name = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
        if (name === 'done') return;
        yield { ...event, type: (event.type as string) ?? name ?? 'message' };
      } catch {
        // A broken line is skipped rather than ending the stream
      }
    }
  }
}
