import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureAdminChatIndexes, getAdminChatExpiry, ADMIN_CHAT_UPLOAD_CHUNK_SIZE } from '@/lib/admin-chat';
import AdminChatMediaChunk from '@/lib/models/AdminChatMediaChunk';
import { requireAdmin } from '@/lib/session';
import { isAdminChatMediaType, sanitizeAdminChatFileName } from '@/lib/admin-chat-constants';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    await ensureAdminChatIndexes();

    const formData = await request.formData();
    const chunk = formData.get('chunk');
    const uploadId = String(formData.get('uploadId') || '');
    const fileName = sanitizeAdminChatFileName(String(formData.get('fileName') || ''));
    const contentType = String(formData.get('contentType') || '');
    const fileSize = Number(formData.get('fileSize'));
    const totalChunks = Number(formData.get('totalChunks'));
    const chunkIndex = Number(formData.get('chunkIndex'));

    if (!(chunk instanceof File)
      || !/^[0-9a-f-]{36}$/i.test(uploadId)
      || !fileName
      || !isAdminChatMediaType(contentType)
      || !Number.isSafeInteger(fileSize)
      || fileSize <= 0
      || !Number.isSafeInteger(totalChunks)
      || totalChunks !== Math.ceil(fileSize / ADMIN_CHAT_UPLOAD_CHUNK_SIZE)
      || !Number.isSafeInteger(chunkIndex)
      || chunkIndex < 0
      || chunkIndex >= totalChunks) {
      return NextResponse.json({ error: 'Potongan media tidak valid' }, { status: 400 });
    }

    const expectedChunkSize = Math.min(ADMIN_CHAT_UPLOAD_CHUNK_SIZE, fileSize - chunkIndex * ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
    if (chunk.size !== expectedChunkSize) {
      return NextResponse.json({ error: 'Ukuran potongan media tidak sesuai' }, { status: 400 });
    }

    await AdminChatMediaChunk.updateOne(
      { uploadId, chunkIndex },
      { $setOnInsert: {
        uploadId,
        chunkIndex,
        data: Buffer.from(await chunk.arrayBuffer()),
        fileName,
        contentType,
        fileSize,
        totalChunks,
        expiresAt: getAdminChatExpiry(),
      } },
      { upsert: true }
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('POST /api/admin-chat/uploads failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan potongan media' }, { status: 500 });
  }
}