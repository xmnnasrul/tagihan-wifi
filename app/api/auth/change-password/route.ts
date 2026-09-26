import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { COOKIE_NAME } from '@/lib/auth';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
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
    const admin = await User.findOne({ username: currentUser.username, role: 'admin', isActive: { $ne: false } });
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password))) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, admin.password)) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password saat ini' }, { status: 400 });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();
    await writeAuditLog({
      actorUsername: admin.username,
      action: 'admin.password_changed',
      entityType: 'admin',
      entityId: admin._id.toString(),
      entityLabel: admin.username,
      summary: `Password admin ${admin.username} diubah; sesi lama dicabut`,
    });

    const response = NextResponse.json({ message: 'Password berhasil diubah. Silakan masuk kembali.' });
    response.cookies.set(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' });
    return response;
  } catch {
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}