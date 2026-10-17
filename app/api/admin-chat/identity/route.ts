import { createPublicKey } from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';

export async function PUT(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const body = await request.json() as { publicKey?: unknown };
    const publicKey = typeof body.publicKey === 'string' ? body.publicKey : '';
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