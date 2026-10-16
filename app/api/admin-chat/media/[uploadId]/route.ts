import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ADMIN_CHAT_UPLOAD_CHUNK_SIZE } from '@/lib/admin-chat';
import AdminChatMediaChunk from '@/lib/models/AdminChatMediaChunk';
import AdminChatMessage from '@/lib/models/AdminChatMessage';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

function parseByteRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || start > requestedEnd) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function GET(request: Request, { params }: { params: { uploadId: string } }) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { uploadId } = params;
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      return NextResponse.json({ error: 'Lampiran tidak ditemukan' }, { status: 404 });
    }

    await connectDB();
    const message = await AdminChatMessage.findOne({
      'attachment.uploadId': uploadId,
      expiresAt: { $gt: new Date() },
    }).select('attachment').lean();
    if (!message?.attachment) {
      return NextResponse.json({ error: 'Lampiran tidak ditemukan atau sudah kedaluwarsa' }, { status: 404 });
    }

    const { attachment } = message;
    const rangeHeader = request.headers.get('range');
    const byteRange = rangeHeader ? parseByteRange(rangeHeader, attachment.size) : null;
    if (rangeHeader && !byteRange) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${attachment.size}`, 'Accept-Ranges': 'bytes' },
      });
    }

    const start = byteRange?.start ?? 0;
    const end = byteRange?.end ?? attachment.size - 1;
    const length = end - start + 1;
    const firstChunk = Math.floor(start / ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
    const lastChunk = Math.floor(end / ADMIN_CHAT_UPLOAD_CHUNK_SIZE);
    const cursor = AdminChatMediaChunk.find({
      uploadId,
      chunkIndex: { $gte: firstChunk, $lte: lastChunk },
    }).select('chunkIndex data').sort({ chunkIndex: 1 }).lean().cursor();
    let nextChunkIndex = firstChunk;
    let streamedBytes = 0;

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await cursor.next();
          if (!chunk) {
            await cursor.close();
            controller.close();
            return;
          }
          if (chunk.chunkIndex !== nextChunkIndex) {
            throw new Error('Potongan lampiran tidak lengkap');
          }

          nextChunkIndex += 1;
          const data = Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data);
          const chunkStart = chunk.chunkIndex * ADMIN_CHAT_UPLOAD_CHUNK_SIZE;
          const sliceStart = Math.max(0, start - chunkStart);
          const sliceEnd = Math.min(data.length, end - chunkStart + 1);
          const slice = data.subarray(sliceStart, sliceEnd);
          streamedBytes += slice.length;
          controller.enqueue(new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength));

          if (streamedBytes >= length) {
            await cursor.close();
            controller.close();
          }
        } catch (error) {
          await cursor.close();
          controller.error(error);
        }
      },
      async cancel() {
        await cursor.close();
      },
    });

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Content-Length': String(length),
      'Content-Type': attachment.contentType,
      'X-Content-Type-Options': 'nosniff',
    });
    if (byteRange) headers.set('Content-Range', `bytes ${start}-${end}/${attachment.size}`);

    return new Response(body, { status: byteRange ? 206 : 200, headers });
  } catch (error) {
    console.error('GET /api/admin-chat/media failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil lampiran chat' }, { status: 500 });
  }
}