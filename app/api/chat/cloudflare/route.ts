import { NextResponse } from 'next/server';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';
import {
  getChatCompletionEndpoint,
  getChatRequestHeaders,
  getCloudflareWorkersAIBaseURL,
  isCloudflareWorkersAIModel,
  normalizeCloudflareAccountID,
} from '@/lib/chat-answer';

const MAX_REQUEST_LENGTH = 100_000;
const MAX_RESPONSE_LENGTH = 1_000_000;

function isChatCompletionBody(value: unknown): value is {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  max_tokens: number;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const messages = candidate.messages;
  if (
    !isCloudflareWorkersAIModel(candidate.model)
    || !Array.isArray(messages)
    || messages.length < 2
    || messages.length > 10
    || candidate.temperature !== 0
    || typeof candidate.max_tokens !== 'number'
    || !Number.isInteger(candidate.max_tokens)
    || candidate.max_tokens < 1
    || candidate.max_tokens > 2048
  ) return false;

  return messages.every((message, index) => {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) return false;
    const item = message as Record<string, unknown>;
    const validRole = index === 0
      ? item.role === 'system'
      : index === messages.length - 1
        ? item.role === 'user'
        : item.role === 'user' || item.role === 'assistant';
    return validRole
      && typeof item.content === 'string'
      && item.content.length > 0;
  });
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403 });

    const requestText = await request.text();
    if (requestText.length > MAX_REQUEST_LENGTH) {
      return NextResponse.json({ error: 'Permintaan chat terlalu besar' }, { status: 413 });
    }

    let data: unknown;
    try {
      data = JSON.parse(requestText) as unknown;
    } catch {
      return NextResponse.json({ error: 'Format permintaan Cloudflare tidak valid' }, { status: 400 });
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return NextResponse.json({ error: 'Format permintaan Cloudflare tidak valid' }, { status: 400 });
    }

    const candidate = data as Record<string, unknown>;
    const accountID = normalizeCloudflareAccountID(candidate.accountID);
    const apiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '';
    if (!accountID || !apiKey || apiKey.length > 500 || !isChatCompletionBody(candidate.requestBody)) {
      return NextResponse.json({ error: 'Konfigurasi atau permintaan Cloudflare tidak valid' }, { status: 400 });
    }

    const baseURL = getCloudflareWorkersAIBaseURL(accountID);
    if (!baseURL) {
      return NextResponse.json({ error: 'Account ID Cloudflare tidak valid' }, { status: 400 });
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(getChatCompletionEndpoint(baseURL, 'cloudflare'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getChatRequestHeaders('cloudflare', apiKey),
        },
        body: JSON.stringify(candidate.requestBody),
        cache: 'no-store',
      });
    } catch {
      return NextResponse.json({ error: 'Tidak dapat terhubung ke Cloudflare Workers AI' }, { status: 502 });
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
    const headers = {
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
    };
    if (upstreamResponse.ok && /text\/event-stream/iu.test(contentType)) {
      return new Response(upstreamResponse.body, { status: upstreamResponse.status, headers });
    }

    const responseBody = await upstreamResponse.text();
    if (responseBody.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: 'Respons Cloudflare terlalu besar' }, { status: 502 });
    }

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    console.error('POST /api/chat/cloudflare failed:', error);
    return NextResponse.json({ error: 'Gagal memproses permintaan Cloudflare' }, { status: 500 });
  }
}
