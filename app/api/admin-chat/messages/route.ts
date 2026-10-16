import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureAdminChatIndexes, getAdminChatExpiry, ADMIN_CHAT_UPLOAD_CHUNK_SIZE } from '@/lib/admin-chat';
import AdminChatMediaChunk from '@/lib/models/AdminChatMediaChunk';
import AdminChatMessage from '@/lib/models/AdminChatMessage';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { isAdminChatMediaType, sanitizeAdminChatFileName } from '@/lib/admin-chat-constants';
import { serializeAdminChatMessage } from '@/lib/admin-chat-serialization';

export const dynamic = 'force-dynamic';

const MAX_MESSAGES = 100;

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    await ensureAdminChatIndexes();
    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');
    const filter: Record<string, unknown> = { expiresAt: { $gt: new Date() } };
    let messages;

    if (after) {
      const afterTimestamp = Date.parse(after);
      if (!Number.isFinite(afterTimestamp)) {
        return NextResponse.json({ error: 'Penanda waktu pesan tidak valid' }, { status: 400 });
      }
      filter.createdAt = { $gte: new Date(afterTimestamp - 60_000) };
      messages = await AdminChatMessage.find(filter).sort({ createdAt: 1, _id: 1 }).limit(MAX_MESSAGES).lean();
    } else {
      messages = await AdminChatMessage.find(filter).sort({ _id: -1 }).limit(MAX_MESSAGES).lean();
      messages.reverse();
    }

    return NextResponse.json({ messages: messages.map((message) => ({
      id: message._id.toString(),
      senderUsername: message.senderUsername,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      expiresAt: message.expiresAt.toISOString(),
      attachment: message.attachment ? {
        ...message.attachment,
        url: `/api/admin-chat/media/${message.attachment.uploadId}`,
      } : null,
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/admin-chat/messages failed:', error);
    return NextResponse.json({ error: 'Gagal memuat pesan chat' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    await ensureAdminChatIndexes();
    const currentUser = await getCurrentUser();
    const body = await request.json() as { text?: unknown; attachment?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length > 4000) {
      return NextResponse.json({ error: 'Pesan maksimal 4.000 karakter' }, { status: 400 });
    }

    let attachment = null;
    if (body.attachment !== undefined && body.attachment !== null) {
      if (typeof body.attachment !== 'object') {
        return NextResponse.json({ error: 'Lampiran tidak valid' }, { status: 400 });
      }

      const rawAttachment = body.attachment as Record<string, unknown>;
      const uploadId = typeof rawAttachment.uploadId === 'string' ? rawAttachment.uploadId : '';
      const fileName = typeof rawAttachment.fileName === 'string'
        ? sanitizeAdminChatFileName(rawAttachment.fileName)
        : '';
      const contentType = typeof rawAttachment.contentType === 'string' ? rawAttachment.contentType : '';
      const size = Number(rawAttachment.size);
      const totalChunks = Number(rawAttachment.totalChunks);

      if (!/^[0-9a-f-]{36}$/i.test(uploadId)
        || !fileName
        || !isAdminChatMediaType(contentType)
        || !Number.isSafeInteger(size)
        || size <= 0
        || !Number.isSafeInteger(totalChunks)
        || totalChunks !== Math.ceil(size / ADMIN_CHAT_UPLOAD_CHUNK_SIZE)) {
        return NextResponse.json({ error: 'Informasi lampiran tidak valid' }, { status: 400 });
      }

      const [uploadedChunks, firstChunk] = await Promise.all([
        AdminChatMediaChunk.countDocuments({ uploadId }),
        AdminChatMediaChunk.findOne({ uploadId }).select('fileName contentType fileSize totalChunks').lean(),
      ]);
      if (uploadedChunks !== totalChunks
        || !firstChunk
        || firstChunk.fileName !== fileName
        || firstChunk.contentType !== contentType
        || firstChunk.fileSize !== size
        || firstChunk.totalChunks !== totalChunks) {
        return NextResponse.json({ error: 'Unggahan belum lengkap' }, { status: 400 });
      }

      attachment = { uploadId, fileName, contentType, size, totalChunks };
    }

    if (!text && !attachment) {
      return NextResponse.json({ error: 'Tulis pesan atau pilih gambar/video' }, { status: 400 });
    }

    const expiresAt = getAdminChatExpiry();
    if (attachment) {
      await AdminChatMediaChunk.updateMany({ uploadId: attachment.uploadId }, { $set: { expiresAt } });
    }

    const message = await AdminChatMessage.create({
      senderUsername: currentUser?.username || 'Admin',
      text,
      attachment,
      expiresAt,
    });

    return NextResponse.json({ message: serializeAdminChatMessage(message) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin-chat/messages failed:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}