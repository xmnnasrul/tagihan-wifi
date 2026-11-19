import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { ChatAIProvider } from '@/lib/chat-answer';

const blockedCustomHostnames = new Set([
  'localhost',
  'metadata.google.internal',
  'host.docker.internal',
]);

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const dnsCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function isLoopbackAddress(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1';
}

export function isPrivateIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [first, second] = ip.split('.').map(Number);
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 0)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }

  if (version === 6) {
    const value = ip.toLowerCase().split('%')[0];
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('::ffff:')) return isPrivateIpAddress(value.slice(7));
    if (value.startsWith('fc') || value.startsWith('fd')) return true;
    return /^fe[89ab]/u.test(value);
  }

  return false;
}

function isAllowedAddress(ip: string): boolean {
  if (isLoopbackAddress(ip)) return process.env.NODE_ENV !== 'production';
  return !isPrivateIpAddress(ip);
}

async function resolvesToAllowedAddress(hostname: string): Promise<boolean> {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    const allowed = addresses.length > 0 && addresses.every((entry) => isAllowedAddress(entry.address));
    if (dnsCache.size > 200) dnsCache.clear();
    dnsCache.set(hostname, { allowed, expiresAt: Date.now() + DNS_CACHE_TTL_MS });
    return allowed;
  } catch {
    return false;
  }
}

export async function isChatAIProxyBaseURLAllowed(
  provider: ChatAIProvider,
  baseURL: string,
): Promise<boolean> {
  if (provider !== 'custom') return true;

  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
  if (
    blockedCustomHostnames.has(hostname)
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home.arpa')
  ) return false;

  if (isIP(hostname)) return isAllowedAddress(hostname);
  return resolvesToAllowedAddress(hostname);
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
