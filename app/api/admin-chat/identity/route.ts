import { createPublicKey } from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AdminChatMessage from '@/lib/models/AdminChatMessage';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { normalizeUserRoles } from '@/lib/roles';
import { publishAdminChatUpdate } from '@/lib/socket-events';

export async function POST() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const currentUser = await getCurrentUser();
    const account = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } });
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });

    account.chatKeyVersion = (account.chatKeyVersion || 0) + 1;
    account.chatPublicKey = '';
    account.chatRecoveryPublicKey = '';
    account.chatRecoveryKeyId = '';
    account.chatRecoveryCiphertext = '';
    account.chatRecoverySalt = '';
    account.chatRecoveryIv = '';
    account.chatRecoveryStatus = 'none';
    account.chatRecoveryPendingPublicKey = '';
    account.chatRecoveryPendingKeyId = '';
    account.chatRecoveryPendingCiphertext = '';
    account.chatRecoveryPendingSalt = '';
    account.chatRecoveryPendingIv = '';
    await Promise.all([
      account.save(),
      AdminChatMessage.updateMany(
        { participantIds: account._id, deletedFor: { $ne: account._id } },
        {
          $addToSet: { deletedFor: account._id },
          $pull: { wrappedKeys: { userId: account._id } },
        },
      ),
    ]);

    const accounts = await User.find({ isActive: { $ne: false } }).select('_id role roles').lean();
    const adminIds = accounts
      .filter((user) => normalizeUserRoles(user.role, user.roles).includes('admin'))
      .map((user) => user._id.toString());
    for (let offset = 0; offset < adminIds.length; offset += 100) {
      void publishAdminChatUpdate(adminIds.slice(offset, offset + 100));
    }

    return NextResponse.json({ keyVersion: account.chatKeyVersion });
  } catch (error) {
    console.error('POST /api/admin-chat/identity reset failed:', error);
    return NextResponse.json({ error: 'Gagal mereset kunci Chat' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const body = await request.json() as { publicKey?: unknown; keyVersion?: unknown };
    const publicKey = typeof body.publicKey === 'string' ? body.publicKey : '';
    const keyVersion = typeof body.keyVersion === 'number' && Number.isSafeInteger(body.keyVersion) && body.keyVersion >= 0
      ? body.keyVersion
      : 0;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || publicKey.length > 2048) {
      return NextResponse.json({ error: 'Public key chat tidak valid' }, { status: 400 });
    }

    const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
      return NextResponse.json({ error: 'Kunci chat harus RSA minimal 2048 bit' }, { status: 400 });
    }

    await connectDB();
    const currentUser = await getCurrentUser();
    const account = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } });
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });
    if ((account.chatKeyVersion || 0) !== keyVersion) {
      return NextResponse.json({ error: 'Versi key chat berubah. Muat ulang halaman.' }, { status: 409 });
    }
    if (account.chatPublicKey && account.chatPublicKey !== publicKey) {
      return NextResponse.json({ error: 'Kunci chat akun sudah terdaftar dan tidak dapat diganti dari perangkat ini' }, { status: 409 });
    }

    if (!account.chatPublicKey) {
      account.chatPublicKey = publicKey;
      await account.save();
    }
    return NextResponse.json({ registered: true });
  } catch (error) {
    console.error('PUT /api/admin-chat/identity failed:', error);
    return NextResponse.json({ error: 'Gagal mendaftarkan kunci chat' }, { status: 400 });
  }
}