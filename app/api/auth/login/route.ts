import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import { loginSchema } from '@/lib/login-validation';
import { checkLoginRateLimit, clearLoginRateLimit, getLoginRateLimitKeys } from '@/lib/login-rate-limit';
import bcrypt from 'bcryptjs';
import { getPrimaryRole, normalizeUserRoles } from '@/lib/roles';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload login tidak valid' }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Username atau password tidak valid' }, { status: 400 });
    }

    await connectDB();
    const rateLimitKeys = getLoginRateLimitKeys(request, parsed.data.username);
    const rateLimit = await checkLoginRateLimit(rateLimitKeys);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan masuk. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      );
    }

    const { username, password } = parsed.data;
    const user = await User.findOne({ username });
    if (!user || user.isActive === false) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    const roles = normalizeUserRoles(user.role, user.roles);
    if (!roles.length) {
      return NextResponse.json({ error: 'Akun tidak memiliki role yang dapat mengakses aplikasi' }, { status: 403 });
    }
    const role = getPrimaryRole(roles);
    if (!role) {
      return NextResponse.json({ error: 'Akun tidak memiliki role yang dapat mengakses aplikasi' }, { status: 403 });
    }
    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
      role,
      roles,
      tokenVersion: user.tokenVersion || 0,
    });

    await clearLoginRateLimit(rateLimitKeys);
    const response = NextResponse.json({ message: 'Login berhasil', user: { username: user.username, role, roles } });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
