import { NextResponse } from 'next/server';
import { encryptChatAIKey, type EncryptedChatAIKey } from '@/lib/chat-ai-crypto';
import { normalizeChatAIConfig } from '@/lib/chat-answer';
import { isChatAIProxyBaseURLAllowed } from '@/lib/chat-ai-proxy';
import ChatAISettings from '@/lib/models/ChatAISettings';
import { connectDB } from '@/lib/mongodb';
import { getAIChatPageAccess, requireAuthenticatedUser, requireSuperadmin } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_REQUEST_LENGTH = 10_000;

function getPublicSettings(value: { provider: string; baseURL: string; model: string } | null) {
  if (!value) return null;
  return {
    provider: value.provider,
    baseURL: value.baseURL,
    model: value.model,
    hasApiKey: true,
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_REQUEST_LENGTH) {
    throw new Error('Permintaan pengaturan AI terlalu besar.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Format pengaturan AI tidak valid.');
  }
}

export async function GET() {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  const access = await getAIChatPageAccess();
  if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

  try {
    await connectDB();
    const settings = await ChatAISettings.findById('global')
      .select('provider baseURL model')
      .lean();
    return NextResponse.json({ config: getPublicSettings(settings) }, { headers: NO_STORE });
  } catch (error) {
    console.error('GET /api/chat/settings failed:', error);
    return NextResponse.json({ error: 'Pengaturan AI gagal dimuat.' }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: Request) {
  const authError = await requireSuperadmin();
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Format pengaturan AI tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    const candidate = body as Record<string, unknown>;
    const submittedApiKey = typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '';
    if (submittedApiKey.length > 500) {
      return NextResponse.json({ error: 'API Key maksimal 500 karakter.' }, { status: 400, headers: NO_STORE });
    }

    const existing = await ChatAISettings.findById('global')
      .select('+encryptedApiKey +apiKeyIV +apiKeyAuthTag')
      .lean();
    const canKeepExistingKey = Boolean(existing?.encryptedApiKey)
      && existing?.provider === candidate.provider;
    const normalized = normalizeChatAIConfig({
      ...candidate,
      apiKey: submittedApiKey || (canKeepExistingKey ? 'existing-encrypted-key' : ''),
    });
    if (!normalized) {
      return NextResponse.json({
        error: 'Pilih penyedia dan model yang valid, lalu masukkan API Key. API Key lama dapat dipertahankan jika penyedianya sama.',
      }, { status: 400, headers: NO_STORE });
    }
    if (!isChatAIProxyBaseURLAllowed(normalized.provider, normalized.baseURL)) {
      return NextResponse.json({ error: 'Base URL Custom API tidak boleh mengarah ke host lokal atau privat.' }, { status: 400, headers: NO_STORE });
    }

    let encryptedKey: EncryptedChatAIKey;
    if (submittedApiKey) {
      try {
        encryptedKey = encryptChatAIKey(submittedApiKey);
      } catch {
        return NextResponse.json({
          error: 'Secret enkripsi belum dikonfigurasi dengan benar di server.',
        }, { status: 503, headers: NO_STORE });
      }
    } else if (canKeepExistingKey && existing) {
      encryptedKey = {
        encryptedApiKey: existing.encryptedApiKey,
        apiKeyIV: existing.apiKeyIV,
        apiKeyAuthTag: existing.apiKeyAuthTag,
      };
    } else {
      return NextResponse.json({ error: 'API Key wajib diisi.' }, { status: 400, headers: NO_STORE });
    }

    const saved = await ChatAISettings.findByIdAndUpdate(
      'global',
      {
        $set: {
          provider: normalized.provider,
          baseURL: normalized.baseURL,
          model: normalized.model,
          ...encryptedKey,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select('provider baseURL model').lean();

    return NextResponse.json({ config: getPublicSettings(saved) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permintaan pengaturan AI terlalu besar.') {
      return NextResponse.json({ error: error.message }, { status: 413, headers: NO_STORE });
    }
    if (error instanceof Error && error.message === 'Format pengaturan AI tidak valid.') {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
    }
    console.error('PUT /api/chat/settings failed:', error);
    return NextResponse.json({ error: 'Pengaturan AI gagal disimpan.' }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE() {
  const authError = await requireSuperadmin();
  if (authError) return authError;

  try {
    await connectDB();
    await ChatAISettings.deleteOne({ _id: 'global' });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error('DELETE /api/chat/settings failed:', error);
    return NextResponse.json({ error: 'Pengaturan AI gagal dihapus.' }, { status: 500, headers: NO_STORE });
  }
}
