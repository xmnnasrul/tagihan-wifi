import { isIP } from 'node:net';
import type { ChatAIProvider } from '@/lib/chat-answer';

const blockedCustomHostnames = new Set([
  'localhost',
  'metadata.google.internal',
  'host.docker.internal',
]);

export function isChatAIProxyBaseURLAllowed(provider: ChatAIProvider, baseURL: string): boolean {
  if (provider !== 'custom') return true;

  const hostname = new URL(baseURL).hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (
    blockedCustomHostnames.has(hostname)
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home.arpa')
  ) return false;

  if (isIP(hostname)) return process.env.NODE_ENV !== 'production' && ['127.0.0.1', '::1'].includes(hostname);
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMessages(value: unknown, roles: readonly string[], maximum: number): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return false;
  return value.every((message) =>
    isRecord(message)
    && typeof message.role === 'string'
    && roles.includes(message.role)
    && typeof message.content === 'string'
    && message.content.length > 0);
}

export function isValidChatAIRequestBody(
  provider: ChatAIProvider,
  model: string,
  body: unknown,
  streaming: boolean,
): boolean {
  if (!isRecord(body)) return false;

  if (provider === 'gemini') {
    if (!Array.isArray(body.contents) || body.contents.length < 1 || body.contents.length > 9) return false;
    return body.contents.every((content) =>
      isRecord(content)
      && (content.role === 'user' || content.role === 'model')
      && Array.isArray(content.parts)
      && content.parts.length > 0
      && content.parts.every((part) => isRecord(part) && typeof part.text === 'string' && part.text.length > 0));
  }

  if (provider === 'codex') {
    return body.model === model
      && typeof body.instructions === 'string'
      && typeof body.input === 'string'
      && body.input.length > 0
      && typeof body.max_output_tokens === 'number'
      && Number.isInteger(body.max_output_tokens)
      && body.max_output_tokens >= 1
      && body.max_output_tokens <= 2048
      && (body.stream === undefined || body.stream === streaming);
  }

  if (provider === 'anthropic') {
    return body.model === model
      && typeof body.system === 'string'
      && body.temperature === 0
      && typeof body.max_tokens === 'number'
      && Number.isInteger(body.max_tokens)
      && body.max_tokens >= 1
      && body.max_tokens <= 2048
      && (body.stream === undefined || body.stream === streaming)
      && isMessages(body.messages, ['user', 'assistant'], 9)
      && (body.messages as Array<Record<string, unknown>>).at(-1)?.role === 'user';
  }

  return body.model === model
    && body.temperature === 0
    && typeof body.max_tokens === 'number'
    && Number.isInteger(body.max_tokens)
    && body.max_tokens >= 1
    && body.max_tokens <= 2048
    && (body.stream === undefined || body.stream === streaming)
    && isMessages(body.messages, ['system', 'user', 'assistant'], 10)
    && (body.messages as Array<Record<string, unknown>>)[0]?.role === 'system'
    && (body.messages as Array<Record<string, unknown>>).at(-1)?.role === 'user';
}
