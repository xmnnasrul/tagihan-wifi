import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { normalizeUserRoles } from '@/lib/roles';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const currentUser = await getCurrentUser();
    const [account, users] = await Promise.all([
      User.findOne({ username: currentUser?.username, isActive: { $ne: false } }).select('_id chatPublicKey').lean(),
      User.find({ isActive: { $ne: false } }).select('_id username role roles profileImage chatPublicKey').sort({ username: 1 }).lean(),
    ]);
    if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });

    return NextResponse.json({
      currentUser: { id: account._id.toString(), publicKey: account.chatPublicKey || '' },
      contacts: users
        .filter((user) => user._id.toString() !== account._id.toString() && normalizeUserRoles(user.role, user.roles).includes('admin'))
        .map((user) => ({
          id: user._id.toString(),
          username: user.username,
          profileImage: user.profileImage || '',
          publicKey: user.chatPublicKey || '',
        })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/admin-chat/contacts failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil daftar admin' }, { status: 500 });
  }
}