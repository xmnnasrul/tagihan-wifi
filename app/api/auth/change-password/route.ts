import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { COOKIE_NAME } from '@/lib/auth';
import { getCurrentUser, requireAuthenticatedUser } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedUser();
    if (authError) return authError;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || newPassword.length < 10) {
      return NextResponse.json({ error: 'Password saat ini wajib diisi dan password baru minimal 10 karakter' }, { status: 400 });
    }

    await connectDB();
    const account = await User.findOne({ username: currentUser.username, isActive: { $ne: false } });
    if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, account.password)) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password saat ini' }, { status: 400 });
    }

    const accountRole = account.role || 'admin';
    const previousTokenVersion = account.tokenVersion || 0;
    account.password = await bcrypt.hash(newPassword, 10);
    account.tokenVersion = previousTokenVersion + 1;
    await account.save();
    await writeAuditLog({
      actorUsername: account.username,
      action: accountRole === 'admin' ? 'admin.password_changed' : 'user.password_changed',
      entityType: 'admin',
      entityId: account._id.toString(),
      entityLabel: account.username,
      summary: `Password ${accountRole} ${account.username} diubah; sesi lama dicabut`,
      changes: {
        before: { credential: 'Nilai tidak dicatat', tokenVersion: previousTokenVersion },
        after: { credential: 'Diperbarui; nilai disembunyikan', tokenVersion: account.tokenVersion },
      },
    });

    const response = NextResponse.json({ message: 'Password berhasil diubah. Silakan masuk kembali.' });
    response.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}