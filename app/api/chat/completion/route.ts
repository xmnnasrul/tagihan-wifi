import { NextResponse } from 'next/server';
import { decryptChatAIKey } from '@/lib/chat-ai-crypto';
import { isValidChatAIRequestBody, isChatAIProxyBaseURLAllowed } from '@/lib/chat-ai-proxy';
import {
  getChatAPIErrorMessage,
  getChatCompletionEndpoint,
  getChatRequestHeaders,
  getChatStreamingEndpoint,
  isChatAIProvider,
  type ChatAIProvider,
} from '@/lib/chat-answer';
import ChatAISettings from '@/lib/models/ChatAISettings';
import { connectDB } from '@/lib/mongodb';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_REQUEST_LENGTH = 100_000;
const MAX_RESPONSE_LENGTH = 1_000_000;

export async function POST(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  const access = await getAIChatPageAccess();
  if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

  try {
    const requestText = await request.text();
    if (requestText.length > MAX_REQUEST_LENGTH) {
      return NextResponse.json({ error: 'Permintaan chat terlalu besar.' }, { status: 413, headers: NO_STORE });
    }

    let body: unknown;
    try {
      body = JSON.parse(requestText) as unknown;
    } catch {
      return NextResponse.json({ error: 'Format permintaan chat tidak valid.' }, { status: 400, headers: NO_STORE });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Format permintaan chat tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    const candidate = body as Record<string, unknown>;
    if (typeof candidate.streaming !== 'boolean') {
      return NextResponse.json({ error: 'Jenis permintaan chat tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    const settings = await ChatAISettings.findById('global')
      .select('+encryptedApiKey +apiKeyIV +apiKeyAuthTag provider baseURL model')
      .lean();
    if (!settings) {
      return NextResponse.json({ error: 'Pengaturan AI belum disimpan oleh superadmin.' }, { status: 503, headers: NO_STORE });
    }

    if (!isChatAIProvider(settings.provider)) {
      return NextResponse.json({ error: 'Penyedia AI yang tersimpan tidak valid.' }, { status: 503, headers: NO_STORE });
    }
    const provider: ChatAIProvider = settings.provider;
    if (
      !isChatAIProxyBaseURLAllowed(provider, settings.baseURL)
      || !isValidChatAIRequestBody(provider, settings.model, candidate.requestBody, candidate.streaming)
    ) {
      return NextResponse.json({ error: 'Konfigurasi atau isi permintaan AI tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    let apiKey: string;
    try {
      apiKey = decryptChatAIKey(settings);
    } catch {
      return NextResponse.json({ error: 'Secret enkripsi AI belum dikonfigurasi dengan benar di server.' }, { status: 503, headers: NO_STORE });
    }

    const endpoint = candidate.streaming
      ? getChatStreamingEndpoint(settings.baseURL, provider, settings.model)
      : getChatCompletionEndpoint(settings.baseURL, provider, settings.model);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getChatRequestHeaders(provider, apiKey),
        },
        body: JSON.stringify(candidate.requestBody),
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      return NextResponse.json({ error: `Tidak dapat terhubung ke ${provider} AI.` }, { status: 502, headers: NO_STORE });
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
    if (upstreamResponse.ok && /text\/event-stream/iu.test(contentType)) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: { ...NO_STORE, 'Content-Type': contentType },
      });
    }

    const responseText = await upstreamResponse.text();
    if (responseText.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: 'Respons penyedia AI terlalu besar.' }, { status: 502, headers: NO_STORE });
    }
    if (!upstreamResponse.ok) {
      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText) as unknown;
      } catch {
        responseData = responseText;
      }
      return NextResponse.json({
        error: getChatAPIErrorMessage(upstreamResponse.status, responseData, apiKey, provider),
      }, { status: upstreamResponse.status, headers: NO_STORE });
    }

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: { ...NO_STORE, 'Content-Type': contentType },
    });
  } catch {
    console.error('POST /api/chat/completion failed');
    return NextResponse.json({ error: 'Chat AI gagal memproses permintaan.' }, { status: 500, headers: NO_STORE });
  }
}
