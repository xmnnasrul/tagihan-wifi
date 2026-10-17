import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ensureAdminChatIndexes, getAdminChatExpiry, ADMIN_CHAT_UPLOAD_CHUNK_SIZE } from '@/lib/admin-chat';
import AdminChatMediaChunk from '@/lib/models/AdminChatMediaChunk';
import AdminChatMessage from '@/lib/models/AdminChatMessage';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { serializeAdminChatMessage } from '@/lib/admin-chat-serialization';
import { normalizeUserRoles } from '@/lib/roles';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

const MAX_MESSAGES = 100;

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    await ensureAdminChatIndexes();
    const currentUser = await getCurrentUser();
    const account = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } })
      .select('_id role roles')
      .lean();
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('with');
    if (!otherUserId || !mongoose.isValidObjectId(otherUserId) || otherUserId === account._id.toString()) {
      return NextResponse.json({ error: 'Pilih admin tujuan chat yang valid' }, { status: 400 });
    }
    const otherAdmin = await User.findOne({ _id: otherUserId, isActive: { $ne: false } })
      .select('_id role roles')
      .lean();
    if (!otherAdmin || !normalizeUserRoles(otherAdmin.role, otherAdmin.roles).includes('admin')) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 });
    }

    const after = searchParams.get('after');
    const filter: Record<string, unknown> = {
      participantIds: { $all: [account._id, otherAdmin._id], $size: 2 },
      deletedFor: { $ne: account._id },
      expiresAt: { $gt: new Date() },
    };
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

    return NextResponse.json({ messages: messages.map(serializeAdminChatMessage) }, { headers: { 'Cache-Control': 'no-store' } });
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
    const sender = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } })
      .select('_id chatPublicKey chatRecoveryPublicKey chatRecoveryKeyId chatRecoveryStatus')
      .lean();
    if (!sender) return NextResponse.json({ error: 'Akun pengirim tidak ditemukan' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const recipientId = typeof body.recipientId === 'string' ? body.recipientId : '';
    const ciphertext = typeof body.ciphertext === 'string' ? body.ciphertext : '';
    const iv = typeof body.iv === 'string' ? body.iv : '';
    const wrappedKeys = Array.isArray(body.wrappedKeys) ? body.wrappedKeys : [];
    if (!mongoose.isValidObjectId(recipientId) || recipientId === sender._id.toString()
      || !ciphertext || ciphertext.length > 40000 || !/^[A-Za-z0-9+/]{16}={0,2}$/.test(iv)
      || wrappedKeys.length < 2 || wrappedKeys.length > 4) {
      return NextResponse.json({ error: 'Pesan terenkripsi tidak valid' }, { status: 400 });
    }

    const recipient = await User.findOne({ _id: recipientId, isActive: { $ne: false } })
      .select('_id role roles chatPublicKey chatRecoveryPublicKey chatRecoveryKeyId chatRecoveryStatus')
      .lean();
    if (!recipient || !normalizeUserRoles(recipient.role, recipient.roles).includes('admin')
      || !sender.chatPublicKey || !recipient.chatPublicKey) {
      return NextResponse.json({ error: 'Kunci chat pengirim atau penerima belum tersedia' }, { status: 409 });
    }
    if (sender.chatRecoveryStatus === 'migrating' || recipient.chatRecoveryStatus === 'migrating') {
      return NextResponse.json({ error: 'Pengiriman sementara dihentikan selama migrasi kunci pemulihan' }, { status: 409 });
    }
    const rawKeys = wrappedKeys.map((entry) => {
      const item = entry as Record<string, unknown>;
      return {
        userId: typeof item.userId === 'string' ? item.userId : '',
        keyId: item.keyId === undefined ? 'primary' : item.keyId,
        encryptedKey: typeof item.encryptedKey === 'string' ? item.encryptedKey : '',
      };
    });
    const expectedWrappedKeys = [
      { userId: sender._id.toString(), keyId: 'primary' },
      ...(sender.chatRecoveryPublicKey ? [{ userId: sender._id.toString(), keyId: sender.chatRecoveryKeyId || 'recovery' }] : []),
      { userId: recipient._id.toString(), keyId: 'primary' },
      ...(recipient.chatRecoveryPublicKey ? [{ userId: recipient._id.toString(), keyId: recipient.chatRecoveryKeyId || 'recovery' }] : []),
    ];
    if (rawKeys.some((key) => !mongoose.isValidObjectId(key.userId)
      || typeof key.keyId !== 'string' || key.keyId.length > 64
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(key.encryptedKey) || key.encryptedKey.length > 2048)
      || new Set(rawKeys.map((key) => `${key.userId}:${key.keyId}`)).size !== rawKeys.length
      || rawKeys.length !== expectedWrappedKeys.length
      || !expectedWrappedKeys.every((expected) => rawKeys.some((key) => key.userId === expected.userId && key.keyId === expected.keyId))) {
      return NextResponse.json({ error: 'Kunci pesan terenkripsi tidak valid' }, { status: 400 });
    }
    const normalizedKeys = rawKeys.map((key) => ({
      userId: new mongoose.Types.ObjectId(key.userId),
      keyId: key.keyId as string,
      encryptedKey: key.encryptedKey,
    }));

    let attachment: { uploadId: string; size: number; totalChunks: number; iv: string } | null = null;
    if (body.attachment !== undefined && body.attachment !== null) {
      if (typeof body.attachment !== 'object') return NextResponse.json({ error: 'Lampiran tidak valid' }, { status: 400 });
      const rawAttachment = body.attachment as Record<string, unknown>;
      const uploadId = typeof rawAttachment.uploadId === 'string' ? rawAttachment.uploadId : '';
      const size = Number(rawAttachment.size);
      const totalChunks = Number(rawAttachment.totalChunks);
      const attachmentIv = typeof rawAttachment.iv === 'string' ? rawAttachment.iv : '';
      if (!/^[0-9a-f-]{36}$/i.test(uploadId) || !Number.isSafeInteger(size) || size <= 16
        || !Number.isSafeInteger(totalChunks) || totalChunks !== Math.ceil(size / ADMIN_CHAT_UPLOAD_CHUNK_SIZE)
        || !/^[A-Za-z0-9+/]{16}={0,2}$/.test(attachmentIv)) {
        return NextResponse.json({ error: 'Informasi lampiran tidak valid' }, { status: 400 });
      }
      const uploadedChunks = await AdminChatMediaChunk.countDocuments({ uploadId, uploadedBy: sender._id });
      if (uploadedChunks !== totalChunks) return NextResponse.json({ error: 'Unggahan terenkripsi belum lengkap' }, { status: 400 });
      attachment = { uploadId, size, totalChunks, iv: attachmentIv };
    }

    const expiresAt = getAdminChatExpiry();
    if (attachment) {
      await AdminChatMediaChunk.updateMany({ uploadId: attachment.uploadId, uploadedBy: sender._id }, { $set: { expiresAt } });
    }

    const message = await AdminChatMessage.create({
      senderId: sender._id,
      recipientId: recipient._id,
      participantIds: [sender._id, recipient._id],
      ciphertext,
      iv,
      wrappedKeys: normalizedKeys,
      deletedFor: [],
      attachment,
      expiresAt,
    });

    return NextResponse.json({ message: serializeAdminChatMessage(message) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin-chat/messages failed:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const currentUser = await getCurrentUser();
    const account = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } }).select('_id').lean();
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });

    const body = await request.json() as { messageIds?: unknown; scope?: unknown };
    if (!Array.isArray(body.messageIds) || body.messageIds.length === 0 || body.messageIds.length > 100
      || body.messageIds.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
      return NextResponse.json({ error: 'Pilih 1 sampai 100 pesan yang valid' }, { status: 400 });
    }
    if (body.scope !== 'me' && body.scope !== 'everyone') {
      return NextResponse.json({ error: 'Jenis penghapusan tidak valid' }, { status: 400 });
    }

    const messageIds = [...new Set(body.messageIds as string[])].map((id) => new mongoose.Types.ObjectId(id));
    const participantFilter = { _id: { $in: messageIds }, participantIds: account._id, expiresAt: { $gt: new Date() } };
    if (body.scope === 'me') {
      const result = await AdminChatMessage.updateMany(
        { ...participantFilter, deletedFor: { $ne: account._id } },
        { $addToSet: { deletedFor: account._id } },
      );
      return NextResponse.json({ deleted: result.modifiedCount });
    }

    const messages = await AdminChatMessage.find({ ...participantFilter, senderId: account._id }).select('_id attachment').lean();
    if (messages.length !== messageIds.length) {
      return NextResponse.json({ error: 'Hapus untuk semua hanya tersedia untuk pesan yang Anda kirim' }, { status: 403 });
    }

    const uploadIds = messages.flatMap((message) => message.attachment?.uploadId ? [message.attachment.uploadId] : []);
    await Promise.all([
      AdminChatMessage.deleteMany({ _id: { $in: messageIds }, senderId: account._id }),
      uploadIds.length
        ? AdminChatMediaChunk.deleteMany({ uploadId: { $in: uploadIds }, uploadedBy: account._id })
        : Promise.resolve(),
    ]);
    return NextResponse.json({ deleted: messages.length });
  } catch (error) {
    console.error('DELETE /api/admin-chat/messages failed:', error);
    return NextResponse.json({ error: 'Gagal menghapus pesan' }, { status: 500 });
  }
}