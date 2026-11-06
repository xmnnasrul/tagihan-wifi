import { NextResponse } from 'next/server';
import { decryptChatAIKey } from '@/lib/chat-ai-crypto';
import {
  getChatAPIErrorMessage,
  getChatModelIDs,
  getChatModelsEndpoint,
  getChatProviderBaseURL,
  getChatRequestHeaders,
  isChatAIProvider,
  normalizeChatBaseURL,
  type ChatAIProvider,
} from '@/lib/chat-answer';
import { isChatAIProxyBaseURLAllowed } from '@/lib/chat-ai-proxy';
import ChatAISettings from '@/lib/models/ChatAISettings';
import { connectDB } from '@/lib/mongodb';
import { requireSuperadmin } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_REQUEST_LENGTH = 10_000;
const MAX_RESPONSE_LENGTH = 1_000_000;

export async function POST(request: Request) {
  const authError = await requireSuperadmin();
  if (authError) return authError;

  try {
    const requestText = await request.text();
    if (requestText.length > MAX_REQUEST_LENGTH) {
      return NextResponse.json({ error: 'Permintaan daftar model terlalu besar.' }, { status: 413, headers: NO_STORE });
    }

    let body: unknown;
    try {
      body = JSON.parse(requestText) as unknown;
    } catch {
      return NextResponse.json({ error: 'Format permintaan daftar model tidak valid.' }, { status: 400, headers: NO_STORE });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Format permintaan daftar model tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    const candidate = body as Record<string, unknown>;
    if (!isChatAIProvider(candidate.provider) || candidate.provider === 'cloudflare') {
      return NextResponse.json({ error: 'Penyedia ini tidak mendukung pemuatan daftar model otomatis.' }, { status: 400, headers: NO_STORE });
    }
    const provider: ChatAIProvider = candidate.provider;
    const baseURL = provider === 'custom'
      ? normalizeChatBaseURL(candidate.baseURL)
      : getChatProviderBaseURL(provider);
    if (!baseURL || !isChatAIProxyBaseURLAllowed(provider, baseURL)) {
      return NextResponse.json({ error: 'Base URL penyedia AI tidak valid atau tidak diizinkan.' }, { status: 400, headers: NO_STORE });
    }

    const submittedApiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '';
    if (submittedApiKey.length > 500 || /[\r\n]/u.test(submittedApiKey)) {
      return NextResponse.json({ error: 'API Key tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    let apiKey = submittedApiKey;
    if (!apiKey) {
      const saved = await ChatAISettings.findById('global')
        .select('+encryptedApiKey +apiKeyIV +apiKeyAuthTag provider baseURL')
        .lean();
      if (!saved || saved.provider !== provider || saved.baseURL !== baseURL) {
        return NextResponse.json({ error: 'Masukkan API Key untuk memuat daftar model.' }, { status: 400, headers: NO_STORE });
      }
      apiKey = decryptChatAIKey(saved);
    }

    let response: Response;
    try {
      response = await fetch(getChatModelsEndpoint(baseURL, provider), {
        headers: getChatRequestHeaders(provider, apiKey),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return NextResponse.json({ error: 'Tidak dapat terhubung ke penyedia AI.' }, { status: 502, headers: NO_STORE });
    }

    const responseText = await response.text();
    if (responseText.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: 'Respons daftar model terlalu besar.' }, { status: 502, headers: NO_STORE });
    }

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText) as unknown;
    } catch {
      responseData = responseText;
    }
    if (!response.ok) {
      return NextResponse.json({
        error: getChatAPIErrorMessage(response.status, responseData, apiKey, provider),
      }, { status: response.status, headers: NO_STORE });
    }

    return NextResponse.json({ models: getChatModelIDs(responseData, provider) }, { headers: NO_STORE });
  } catch (error) {
    if (
      error instanceof Error
      && (error.message.includes('CHAT_AI_ENCRYPTION_KEY') || error.message.includes('Encrypted chat API key'))
    ) {
      return NextResponse.json({ error: 'Secret enkripsi AI belum dikonfigurasi dengan benar di server.' }, { status: 503, headers: NO_STORE });
    }
    console.error('POST /api/chat/models failed:', error);
    return NextResponse.json({ error: 'Daftar model AI gagal dimuat.' }, { status: 500, headers: NO_STORE });
  }
}
