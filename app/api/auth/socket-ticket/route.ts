import { NextResponse } from 'next/server';
import { signSocketTicket } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { normalizeUserRoles } from '@/lib/roles';

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });
  }

  try {
    await connectDB();
    const account = await User.findOne({
      username: currentUser.username,
      isActive: { $ne: false },
    }).select('_id username role roles tokenVersion chatRecoveryStatus').lean();

    if (!account) {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 401 });
    }
    if (account.chatRecoveryStatus !== 'ready') {
      return NextResponse.json({ error: 'Buat sandi Chat terlebih dahulu untuk menggunakan chat.' }, { status: 403 });
    }

    const ticket = signSocketTicket({
      userId: account._id.toString(),
      username: account.username,
      role: account.role || 'admin',
      roles: normalizeUserRoles(account.role, account.roles),
      tokenVersion: account.tokenVersion || 0,
    });

    return NextResponse.json(
      { ticket },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch {
    return NextResponse.json({ error: 'Gagal membuat tiket socket' }, { status: 503 });
  }
}