import { createPublicKey } from 'node:crypto';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AdminChatMessage from '@/lib/models/AdminChatMessage';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';

const MAX_MIGRATION_BATCH = 100;
const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

async function getCurrentAccount() {
  const currentUser = await getCurrentUser();
  return User.findOne({ username: currentUser?.username, isActive: { $ne: false } });
}

function isValidRsaPublicKey(value: string): boolean {
  try {
    if (!base64Pattern.test(value) || value.length > 2048) return false;
    const key = createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' });
    return key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength || 0) >= 2048;
  } catch {
    return false;
  }
}

function missingRecoveryWrapperFilter(accountId: mongoose.Types.ObjectId, recoveryKeyId: string) {
  return {
    $and: [
      { wrappedKeys: { $elemMatch: { userId: accountId } } },
      { wrappedKeys: { $not: { $elemMatch: { userId: accountId, keyId: recoveryKeyId } } } },
    ],
  };
}

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });
    const migrationKeyId = account.chatRecoveryPendingKeyId || account.chatRecoveryKeyId;
    if ((!account.chatRecoveryPublicKey && !account.chatRecoveryPendingPublicKey) || account.chatRecoveryStatus === 'none') {
      return NextResponse.json({ error: 'Backup kunci pemulihan belum disiapkan' }, { status: 409 });
    }
    if (!migrationKeyId) {
      return NextResponse.json({ error: 'Versi kunci pemulihan tidak tersedia' }, { status: 409 });
    }
    if (account.chatRecoveryStatus === 'ready' && !account.chatRecoveryPendingKeyId) {
      return NextResponse.json({ status: 'ready', messages: [], nextAfter: null });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId !== account._id.toString()) {
      return NextResponse.json({ error: 'Sesi akun berubah; muat ulang halaman chat.' }, { status: 409 });
    }
    const after = searchParams.get('after');
    if (after && !mongoose.isValidObjectId(after)) {
      return NextResponse.json({ error: 'Cursor migrasi tidak valid' }, { status: 400 });
    }
    const query: Record<string, unknown> = {
      participantIds: account._id,
      deletedFor: { $ne: account._id },
      expiresAt: { $gt: new Date() },
      ...missingRecoveryWrapperFilter(account._id, migrationKeyId),
    };
    if (after) query._id = { $gt: new mongoose.Types.ObjectId(after) };

    const messages = await AdminChatMessage.find(query)
      .select('_id wrappedKeys')
      .sort({ _id: 1 })
      .limit(MAX_MIGRATION_BATCH)
      .lean();
    const accountId = account._id.toString();
    return NextResponse.json({
      status: 'migrating',
      messages: messages.map((message) => ({
        id: message._id.toString(),
        wrappedKeys: message.wrappedKeys
          .filter((key) => key.userId.toString() === accountId)
          .map((key) => ({ userId: accountId, keyId: key.keyId || 'primary', encryptedKey: key.encryptedKey })),
      })),
      nextAfter: messages.length === MAX_MIGRATION_BATCH ? messages[messages.length - 1]._id.toString() : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('GET /api/admin-chat/identity/recovery failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil batch migrasi kunci' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    if (typeof body.accountId !== 'string' || body.accountId !== account._id.toString()) {
      return NextResponse.json({ error: 'Sesi akun berubah; muat ulang halaman chat.' }, { status: 409 });
    }
    if (body.action === 'cancel') {
      if (account.chatRecoveryStatus !== 'migrating' || !account.chatRecoveryPendingKeyId || !account.chatRecoveryPublicKey) {
        return NextResponse.json({ error: 'Tidak ada rotasi yang dapat dibatalkan' }, { status: 409 });
      }
      account.chatRecoveryPendingPublicKey = '';
      account.chatRecoveryPendingKeyId = '';
      account.chatRecoveryPendingCiphertext = '';
      account.chatRecoveryPendingSalt = '';
      account.chatRecoveryPendingIv = '';
      account.chatRecoveryStatus = 'ready';
      await account.save();
      return NextResponse.json({ status: 'ready', cancelled: true });
    }
    if (body.action === 'begin') {
      const recoveryPublicKey = typeof body.recoveryPublicKey === 'string' ? body.recoveryPublicKey : '';
      const recoveryKeyId = typeof body.recoveryKeyId === 'string' ? body.recoveryKeyId : '';
      const rotate = body.rotate === true;
      const ciphertext = typeof body.ciphertext === 'string' ? body.ciphertext : '';
      const salt = typeof body.salt === 'string' ? body.salt : '';
      const iv = typeof body.iv === 'string' ? body.iv : '';
      if (!account.chatPublicKey || !isValidRsaPublicKey(recoveryPublicKey)
        || !/^recovery-[0-9a-f-]{36}$/.test(recoveryKeyId)
        || !base64Pattern.test(ciphertext) || ciphertext.length > 8192
        || !base64Pattern.test(salt) || salt.length > 64
        || !base64Pattern.test(iv) || iv.length > 32) {
        return NextResponse.json({ error: 'Data backup kunci pemulihan tidak valid' }, { status: 400 });
      }
      if (account.chatRecoveryPendingKeyId && account.chatRecoveryPendingKeyId !== recoveryKeyId) {
        return NextResponse.json({ error: 'Migrasi recovery key lain masih berlangsung' }, { status: 409 });
      }
      if (account.chatRecoveryPublicKey && !account.chatRecoveryPendingKeyId && !rotate
        && (account.chatRecoveryPublicKey !== recoveryPublicKey || account.chatRecoveryKeyId !== recoveryKeyId)) {
        return NextResponse.json({ error: 'Kunci pemulihan akun sudah terdaftar' }, { status: 409 });
      }

      const sameActiveKey = account.chatRecoveryStatus === 'ready' && !rotate
        && account.chatRecoveryPublicKey === recoveryPublicKey && account.chatRecoveryKeyId === recoveryKeyId;
      if (sameActiveKey) {
        account.chatRecoveryCiphertext = ciphertext;
        account.chatRecoverySalt = salt;
        account.chatRecoveryIv = iv;
      } else {
        account.chatRecoveryPendingPublicKey = recoveryPublicKey;
        account.chatRecoveryPendingKeyId = recoveryKeyId;
        account.chatRecoveryPendingCiphertext = ciphertext;
        account.chatRecoveryPendingSalt = salt;
        account.chatRecoveryPendingIv = iv;
        account.chatRecoveryStatus = 'migrating';
      }
      await account.save();
      return NextResponse.json({ status: account.chatRecoveryStatus, pending: !sameActiveKey });
    }

    if (body.action === 'batch') {
      if (!account.chatRecoveryPendingPublicKey || account.chatRecoveryStatus !== 'migrating'
        || !account.chatRecoveryPendingKeyId
        || !Array.isArray(body.keys) || body.keys.length === 0 || body.keys.length > MAX_MIGRATION_BATCH) {
        return NextResponse.json({ error: 'Batch migrasi tidak valid' }, { status: 400 });
      }
      const entries = body.keys.map((value) => {
        const item = value as Record<string, unknown>;
        return {
          id: typeof item.id === 'string' ? item.id : '',
          encryptedKey: typeof item.encryptedKey === 'string' ? item.encryptedKey : '',
        };
      });
      if (entries.some((entry) => !mongoose.isValidObjectId(entry.id)
        || !base64Pattern.test(entry.encryptedKey) || entry.encryptedKey.length > 2048)
        || new Set(entries.map((entry) => entry.id)).size !== entries.length) {
        return NextResponse.json({ error: 'Kunci pesan migrasi tidak valid' }, { status: 400 });
      }

      const now = new Date();
      const operations = entries.map((entry) => ({
        updateOne: {
          filter: {
            _id: new mongoose.Types.ObjectId(entry.id),
            participantIds: account._id,
            deletedFor: { $ne: account._id },
            expiresAt: { $gt: now },
            ...missingRecoveryWrapperFilter(account._id, account.chatRecoveryPendingKeyId),
          },
          update: {
            $push: {
              wrappedKeys: {
                userId: account._id,
                keyId: account.chatRecoveryPendingKeyId,
                encryptedKey: entry.encryptedKey,
              },
            },
          },
        },
      }));
      const result = await AdminChatMessage.bulkWrite(operations, { ordered: false });
      return NextResponse.json({ modified: result.modifiedCount });
    }

    if (body.action === 'complete') {
      if (!account.chatRecoveryPendingPublicKey || !account.chatRecoveryPendingKeyId || account.chatRecoveryStatus !== 'migrating') {
        return NextResponse.json({ error: 'Migrasi kunci tidak sedang berjalan' }, { status: 409 });
      }
      const remainingMessages = await AdminChatMessage.countDocuments({
        participantIds: account._id,
        deletedFor: { $ne: account._id },
        expiresAt: { $gt: new Date() },
        ...missingRecoveryWrapperFilter(account._id, account.chatRecoveryPendingKeyId),
      });
      if (remainingMessages > 0) {
        return NextResponse.json({ error: 'Masih ada pesan yang belum dimigrasikan', remainingMessages }, { status: 409 });
      }
      account.chatRecoveryPublicKey = account.chatRecoveryPendingPublicKey;
      account.chatRecoveryKeyId = account.chatRecoveryPendingKeyId;
      account.chatRecoveryCiphertext = account.chatRecoveryPendingCiphertext;
      account.chatRecoverySalt = account.chatRecoveryPendingSalt;
      account.chatRecoveryIv = account.chatRecoveryPendingIv;
      account.chatRecoveryPendingPublicKey = '';
      account.chatRecoveryPendingKeyId = '';
      account.chatRecoveryPendingCiphertext = '';
      account.chatRecoveryPendingSalt = '';
      account.chatRecoveryPendingIv = '';
      account.chatRecoveryStatus = 'ready';
      await account.save();
      return NextResponse.json({ status: 'ready' });
    }

    return NextResponse.json({ error: 'Aksi pemulihan tidak dikenal' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/admin-chat/identity/recovery failed:', error);
    return NextResponse.json({ error: 'Gagal memperbarui backup kunci pemulihan' }, { status: 500 });
  }
}
