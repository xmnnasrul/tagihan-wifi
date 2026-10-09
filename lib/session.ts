import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME, TokenPayload } from './auth';
import { connectDB } from './mongodb';
import User from './models/User';
import { normalizeUserRoles, UserRole } from './roles';

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuthenticatedUser(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });
  }

  try {
    await connectDB();
    const activeUser = await User.findOne({
      username: user.username,
      isActive: { $ne: false },
    }).select('_id role tokenVersion').lean();
    if (!activeUser) {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
    }
    if ((activeUser.role || 'admin') !== user.role) {
      return NextResponse.json({ error: 'Peran akun berubah, silakan masuk kembali' }, { status: 401 });
    }
    if ((user.tokenVersion || 0) !== (activeUser.tokenVersion || 0)) {
      return NextResponse.json({ error: 'Sesi berakhir, silakan masuk kembali' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Gagal memverifikasi akun' }, { status: 503 });
  }

  return null;
}

export async function requireAnyRole(allowedRoles: UserRole[]): Promise<NextResponse | null> {
  const authError = await requireAuthenticatedUser();
  if (authError) return authError;

  const user = await getCurrentUser();
  const roles = normalizeUserRoles(user?.role, user?.roles);
  if (!allowedRoles.some((role) => roles.includes(role))) {
    return NextResponse.json({ error: 'Akses tidak diizinkan untuk role akun ini' }, { status: 403 });
  }

  return null;
}

export async function requireAdmin(): Promise<NextResponse | null> {
  return requireAnyRole(['admin']);
}

export async function requireCollectorOrAdmin(): Promise<NextResponse | null> {
  return requireAnyRole(['admin', 'collector']);
}
