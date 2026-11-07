import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getDataOwnerScope } from '@/lib/data-ownership';
import { getAIChatPageAccess, requireAuthenticatedUser } from '@/lib/session';
import { MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH, mergeChatKnowledgeSummary } from '@/lib/chat-answer';
import ChatKnowledge from '@/lib/models/ChatKnowledge';
import { connectDB } from '@/lib/mongodb';

const MAX_KNOWLEDGE_LENGTH = 1500;
const NO_STORE = { 'Cache-Control': 'no-store' };

function validateContent(value: unknown, maxLength = MAX_KNOWLEDGE_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const content = value.trim().replace(/\s+/gu, ' ');
  return content.length > 0 && content.length <= maxLength ? content : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const items = await ChatKnowledge.find({ ownerId })
      .select('content createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      items: items.map(({ _id, content, createdAt, updatedAt }) => ({
        id: _id.toString(), content, createdAt, updatedAt,
      })),
    }, { headers: NO_STORE });
  } catch (error) {
    console.error('GET /api/chat/knowledge failed:', error);
    return NextResponse.json({ error: 'Gagal memuat pengetahuan Alfii' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

    const body = await readBody(request);
    const content = validateContent(body?.content);
    if (!content) {
      return NextResponse.json({ error: `Pengetahuan wajib diisi dan maksimal ${MAX_KNOWLEDGE_LENGTH} karakter` }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const existingItems = await ChatKnowledge.find({ ownerId })
      .select('content createdAt updatedAt')
      .sort({ createdAt: 1 })
      .lean();
    const summary = mergeChatKnowledgeSummary(existingItems.map(({ content }) => content), content);
    if (!summary) {
      return NextResponse.json({
        error: `Rangkuman memori sudah mencapai batas ${MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH} karakter. Memori baru belum disimpan.`,
      }, { status: 409, headers: NO_STORE });
    }

    let item: {
      _id: Types.ObjectId;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    if (existingItems.length > 0) {
      const currentSummary = existingItems[0];
      item = await ChatKnowledge.findOneAndUpdate(
        { _id: currentSummary._id, ownerId, content: currentSummary.content },
        { content: summary },
        { returnDocument: 'after', runValidators: true },
      ).lean();
      if (!item) {
        return NextResponse.json({ error: 'Memori berubah bersamaan. Coba kirim penjelasan lagi.' }, { status: 409, headers: NO_STORE });
      }
      if (existingItems.length > 1) {
        await ChatKnowledge.deleteMany({
          _id: { $in: existingItems.slice(1).map(({ _id }) => _id) },
          ownerId,
        });
      }
    } else {
      item = await ChatKnowledge.create({ ownerId, content: summary });
    }
    return NextResponse.json({
      item: { id: item._id.toString(), content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt },
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error('POST /api/chat/knowledge failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan pengetahuan Alfii' }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

    const body = await readBody(request);
    const id = typeof body?.id === 'string' ? body.id : '';
    const content = validateContent(body?.content, MAX_CHAT_KNOWLEDGE_SUMMARY_LENGTH);
    if (!Types.ObjectId.isValid(id) || !content) {
      return NextResponse.json({ error: 'Data pengetahuan tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    if (await ChatKnowledge.exists({ _id: { $ne: id }, ownerId, content })) {
      return NextResponse.json({ error: 'Pengetahuan yang sama sudah tersimpan.' }, { status: 409, headers: NO_STORE });
    }
    const item = await ChatKnowledge.findOneAndUpdate(
      { _id: id, ownerId },
      { content },
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!item) return NextResponse.json({ error: 'Pengetahuan tidak ditemukan.' }, { status: 404, headers: NO_STORE });

    return NextResponse.json({
      item: { id: item._id.toString(), content: item.content, createdAt: item.createdAt, updatedAt: item.updatedAt },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error('PUT /api/chat/knowledge failed:', error);
    return NextResponse.json({ error: 'Gagal memperbarui pengetahuan Alfii' }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  try {
    const access = await getAIChatPageAccess();
    if (!access.allowed) return NextResponse.json({ error: 'Akses Chat AI ditolak' }, { status: 403, headers: NO_STORE });

    const id = new URL(request.url).searchParams.get('id') || '';
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID pengetahuan tidak valid.' }, { status: 400, headers: NO_STORE });
    }

    await connectDB();
    const { ownerId } = await getDataOwnerScope();
    const result = await ChatKnowledge.deleteOne({ _id: id, ownerId });
    if (!result.deletedCount) {
      return NextResponse.json({ error: 'Pengetahuan tidak ditemukan.' }, { status: 404, headers: NO_STORE });
    }

    return NextResponse.json({ deleted: true }, { headers: NO_STORE });
  } catch (error) {
    console.error('DELETE /api/chat/knowledge failed:', error);
    return NextResponse.json({ error: 'Gagal menghapus pengetahuan Alfii' }, { status: 500, headers: NO_STORE });
  }
}
