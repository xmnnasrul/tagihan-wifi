import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const currentUser = await getCurrentUser();
    const accounts = await User.find({})
      .select('username role isActive createdAt')
      .sort({ username: 1 })
      .lean();

    return NextResponse.json({
      currentUsername: currentUser?.username || '',
      admins: accounts.map((account) => ({
        ...account,
        role: account.role || 'admin',
        isActive: account.isActive !== false,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data admin' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 10) {
      return NextResponse.json(
        { error: 'Username harus 3-32 karakter; password minimal 10 karakter' },
        { status: 400 }
      );
    }

    if (await User.findOne({ username }).lean()) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const admin = await User.create({
      username,
      password: await bcrypt.hash(password, 10),
      role: 'user',
      isActive: true,
    });
    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'user.created',
      entityType: 'admin',
      entityId: admin._id.toString(),
      entityLabel: admin.username,
      summary: `Akun user ${admin.username} dibuat`,
    });

    return NextResponse.json({
      _id: admin._id,
      username: admin.username,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal membuat akun pengguna' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const body = await request.json();
    const { id, isActive, password } = body;
    if (typeof id !== 'string') {
      return NextResponse.json({ error: 'ID admin wajib diisi' }, { status: 400 });
    }

    const actor = await getCurrentUser();
    const admin = await User.findById(id);
    if (!admin) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    if (typeof password === 'string') {
      if (password.length < 10) {
        return NextResponse.json({ error: 'Password baru minimal 10 karakter' }, { status: 400 });
      }

      admin.password = await bcrypt.hash(password, 10);
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
      await admin.save();
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'admin.password_reset',
        entityType: 'admin',
        entityId: admin._id.toString(),
        entityLabel: admin.username,
        summary: `Password admin ${admin.username} direset; sesi lama dicabut`,
      });

      return NextResponse.json({
        message: 'Password berhasil direset',
        requiresLogin: actor?.username === admin.username,
      });
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Status aktif admin wajib diisi' }, { status: 400 });
    }

    if (!isActive && actor?.username === admin.username) {
      return NextResponse.json({ error: 'Akun yang sedang digunakan tidak dapat dinonaktifkan' }, { status: 400 });
    }

    const accountRole = admin.role || 'admin';
    if (!isActive && accountRole === 'admin' && admin.isActive !== false) {
      const activeAdmins = await User.countDocuments({
        $or: [{ role: 'admin' }, { role: { $exists: false } }, { role: null }],
        isActive: { $ne: false },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json({ error: 'Minimal harus ada satu admin aktif' }, { status: 400 });
      }
    }

    admin.isActive = isActive;
    await admin.save();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: isActive
        ? (accountRole === 'admin' ? 'admin.activated' : 'user.activated')
        : (accountRole === 'admin' ? 'admin.deactivated' : 'user.deactivated'),
      entityType: 'admin',
      entityId: admin._id.toString(),
      entityLabel: admin.username,
      summary: `Akun ${accountRole} ${admin.username} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
    });

    return NextResponse.json({ message: `Admin ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status admin' }, { status: 500 });
  }
}