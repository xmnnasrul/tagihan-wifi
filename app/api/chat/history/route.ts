import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ChatMessage, { ChatMessageRole } from '@/lib/models/ChatMessage';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';
import { getDataOwnerScope } from '@/lib/data-ownership';

const HISTORY_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;
const MAX_USER_MESSAGE_LENGTH = 500;
const MAX_ASSISTANT_MESSAGE_LENGTH = 20000;

export async function GET() {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403 });

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const messages = await ChatMessage.find({
      ownerId,
      expiresAt: { $gt: new Date() },
    })
      .select('role content createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      messages: messages.reverse().map(({ role, content }) => ({ role, content })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/chat/history failed:', error);
    return NextResponse.json({ error: 'Gagal memuat riwayat chat' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403 });

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body) || !('messages' in body) || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Format riwayat chat tidak valid' }, { status: 400 });
    }

    if (body.messages.length < 1 || body.messages.length > 2) {
      return NextResponse.json({ error: 'Maksimal dua pesan dapat disimpan sekaligus' }, { status: 400 });
    }

    const messages: Array<{ role: ChatMessageRole; content: string }> = [];
    for (const value of body.messages) {
      if (typeof value !== 'object' || value === null || Array.isArray(value) || !('role' in value) || !('content' in value)) {
        return NextResponse.json({ error: 'Pesan riwayat chat tidak valid' }, { status: 400 });
      }
      const { role, content } = value;
      if (
        (role !== 'user' && role !== 'assistant')
        || typeof content !== 'string'
        || !content.trim()
        || content.length > (role === 'user' ? MAX_USER_MESSAGE_LENGTH : MAX_ASSISTANT_MESSAGE_LENGTH)
      ) {
        return NextResponse.json({ error: 'Pesan riwayat chat tidak valid' }, { status: 400 });
      }
      messages.push({ role, content });
    }

    if (messages.length === 2 && (messages[0].role !== 'user' || messages[1].role !== 'assistant')) {
      return NextResponse.json({ error: 'Urutan pesan riwayat chat tidak valid' }, { status: 400 });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HISTORY_RETENTION_MS);
    const savedMessages = await ChatMessage.insertMany(messages.map((message) => ({
      ...message,
      ownerId,
      createdAt: now,
      expiresAt,
    })));

    return NextResponse.json({
      messages: savedMessages.map(({ role, content }) => ({ role, content })),
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('POST /api/chat/history failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan riwayat chat' }, { status: 500 });
  }
}
