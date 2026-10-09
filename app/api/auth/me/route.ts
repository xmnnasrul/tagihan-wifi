import { NextResponse } from 'next/server';
import { COOKIE_NAME, signToken } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin, requireAuthenticatedUser } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { getPrimaryRole, normalizeUserRoles } from '@/lib/roles';

export async function GET() {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  const payload = await getCurrentUser();
  if (!payload) return NextResponse.json({ user: null }, { status: 401 });

  await connectDB();
  const account = await User.findOne({ username: payload.username, isActive: { $ne: false } })
    .select('username role roles tokenVersion')
    .lean();
  if (!account) return NextResponse.json({ user: null }, { status: 401 });

  const roles = normalizeUserRoles(account.role, account.roles);
  return NextResponse.json({ user: {
    username: account.username,
    role: getPrimaryRole(roles),
    roles,
    tokenVersion: account.tokenVersion || 0,
  } });
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });
    }

    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json({ error: 'Username harus 3-32 karakter dan hanya berisi huruf, angka, titik, garis bawah, atau tanda hubung' }, { status: 400 });
    }

    await connectDB();
    const account = await User.findOne({ username: currentUser.username, isActive: { $ne: false } });
    if (!account) {
      return NextResponse.json({ error: 'Akun tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await User.findOne({
      username: { $regex: `^${escapedUsername}$`, $options: 'i' },
      _id: { $ne: account._id },
    }).lean();
    if (duplicate) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const previousUsername = account.username;
    if (username === previousUsername) {
      return NextResponse.json({ message: 'Username tidak berubah', username });
    }

    account.username = username;
    await account.save();
    const roles = normalizeUserRoles(account.role, account.roles);
    const role = getPrimaryRole(roles);
    await writeAuditLog({
      actorUsername: previousUsername,
      action: role === 'admin' ? 'admin.username_updated' : 'user.username_updated',
      entityType: 'admin',
      entityId: account._id.toString(),
      entityLabel: username,
      summary: `Username akun ${previousUsername} diubah menjadi ${username}`,
      changes: { before: { username: previousUsername }, after: { username } },
    });

    const response = NextResponse.json({ message: 'Username berhasil diubah', username });
    response.cookies.set(COOKIE_NAME, signToken({
      username,
      role,
      roles,
      tokenVersion: account.tokenVersion || 0,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal mengubah username' }, { status: 500 });
  }
}
