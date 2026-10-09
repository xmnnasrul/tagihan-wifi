import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';
import { COOKIE_NAME, signToken } from '@/lib/auth';
import { getPrimaryRole, normalizeUserRoles, USER_ROLES, UserRole } from '@/lib/roles';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    await connectDB();
    const currentUser = await getCurrentUser();
    const accounts = await User.find({})
      .select('username role roles isActive createdAt')
      .sort({ username: 1 })
      .lean();

    return NextResponse.json({
      currentUsername: currentUser?.username || '',
      admins: accounts.map((account) => ({
        ...account,
        role: getPrimaryRole(normalizeUserRoles(account.role, account.roles)),
        roles: normalizeUserRoles(account.role, account.roles),
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
    if (body.roles !== undefined && (!Array.isArray(body.roles) || body.roles.length === 0 || body.roles.some((role: unknown) => !USER_ROLES.includes(role as UserRole)))) {
      return NextResponse.json({ error: 'Pilih minimal satu role yang valid' }, { status: 400 });
    }
    const roles = normalizeUserRoles('user', body.roles ?? ['user']);
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 10) {
      return NextResponse.json(
        { error: 'Username harus 3-32 karakter; password minimal 10 karakter' },
        { status: 400 }
      );
    }

    if (await User.findOne({ username }).lean()) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const primaryRole = getPrimaryRole(roles);
    const admin = await User.create({
      username,
      password: await bcrypt.hash(password, 10),
      role: primaryRole,
      roles,
      isActive: true,
    });
    const actor = await getCurrentUser();
    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'user.created',
      entityType: 'admin',
      entityId: admin._id.toString(),
      entityLabel: admin.username,
      summary: `Akun ${roles.join(' + ')} ${admin.username} dibuat`,
      changes: { before: null, after: { username: admin.username, role: primaryRole, roles: roles.join(', '), isActive: admin.isActive } },
    });

    return NextResponse.json({
      _id: admin._id,
      username: admin.username,
      role: primaryRole,
      roles,
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
    const { id, isActive, password, roles: requestedRoles, username: requestedUsername } = body;
    if (typeof id !== 'string') {
      return NextResponse.json({ error: 'ID admin wajib diisi' }, { status: 400 });
    }

    const actor = await getCurrentUser();
    const admin = await User.findById(id);
    if (!admin) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    if (requestedRoles !== undefined) {
      if (!Array.isArray(requestedRoles) || requestedRoles.length === 0 || requestedRoles.some((role: unknown) => !USER_ROLES.includes(role as UserRole))) {
        return NextResponse.json({ error: 'Pilih minimal satu role yang valid' }, { status: 400 });
      }
      if (actor?.username === admin.username) {
        return NextResponse.json({ error: 'Role akun yang sedang digunakan tidak dapat diubah dari sini' }, { status: 400 });
      }

      const previousRoles = normalizeUserRoles(admin.role, admin.roles);
      const nextRoles = normalizeUserRoles(admin.role, requestedRoles);
      if (actor?.username === admin.username && previousRoles.includes('admin') && !nextRoles.includes('admin')) {
        return NextResponse.json({ error: 'Role Admin akun yang sedang digunakan tidak dapat dicabut' }, { status: 400 });
      }
      if (previousRoles.includes('admin') && !nextRoles.includes('admin')) {
        const otherAccounts = await User.find({ _id: { $ne: admin._id }, isActive: { $ne: false } })
          .select('role roles')
          .lean();
        if (!otherAccounts.some((account) => normalizeUserRoles(account.role, account.roles).includes('admin'))) {
          return NextResponse.json({ error: 'Minimal harus ada satu admin aktif' }, { status: 400 });
        }
      }

      const previousTokenVersion = admin.tokenVersion || 0;
      const nextPrimaryRole = getPrimaryRole(nextRoles);
      admin.roles = nextRoles;
      admin.role = nextPrimaryRole;
      admin.tokenVersion = previousTokenVersion + 1;
      await admin.save();
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'user.roles_updated',
        entityType: 'admin',
        entityId: admin._id.toString(),
        entityLabel: admin.username,
        summary: `Role akun ${admin.username} diubah menjadi ${nextRoles.join(' + ')}`,
        changes: { before: { roles: previousRoles.join(', ') }, after: { roles: nextRoles.join(', ') } },
      });

      return NextResponse.json({
        message: 'Role akun diperbarui.',
        roles: nextRoles,
        requiresLogin: actor?.username === admin.username,
      });
    }

    if (typeof requestedUsername === 'string') {
      if (actor?.username !== admin.username) {
        return NextResponse.json({ error: 'Anda hanya dapat mengubah username akun sendiri' }, { status: 403 });
      }

      const username = requestedUsername.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return NextResponse.json({ error: 'Username harus 3-32 karakter dan hanya berisi huruf, angka, titik, garis bawah, atau tanda hubung' }, { status: 400 });
      }

      const duplicate = await User.findOne({
        username: { $regex: `^${username}$`, $options: 'i' },
        _id: { $ne: admin._id },
      }).lean();
      if (duplicate) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
      }

      const previousUsername = admin.username;
      if (username === previousUsername) {
        return NextResponse.json({ message: 'Username tidak berubah', username });
      }

      admin.username = username;
      await admin.save();
      const accountRoles = normalizeUserRoles(admin.role, admin.roles);
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: accountRoles.includes('admin') ? 'admin.username_updated' : 'user.username_updated',
        entityType: 'admin',
        entityId: admin._id.toString(),
        entityLabel: username,
        summary: `Username akun ${previousUsername} diubah menjadi ${username}`,
        changes: { before: { username: previousUsername }, after: { username } },
      });

      const response = NextResponse.json({ message: 'Username berhasil diubah', username });
      if (actor?.username === previousUsername) {
        const token = signToken({
          username,
          role: getPrimaryRole(normalizeUserRoles(admin.role, admin.roles)),
          roles: normalizeUserRoles(admin.role, admin.roles),
          tokenVersion: admin.tokenVersion || 0,
        });
        response.cookies.set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }
      return response;
    }

    if (typeof password === 'string') {
      if (password.length < 10) {
        return NextResponse.json({ error: 'Password baru minimal 10 karakter' }, { status: 400 });
      }

      const previousTokenVersion = admin.tokenVersion || 0;
      admin.password = await bcrypt.hash(password, 10);
      admin.tokenVersion = previousTokenVersion + 1;
      await admin.save();
      await writeAuditLog({
        actorUsername: actor?.username || 'Admin',
        action: 'admin.password_reset',
        entityType: 'admin',
        entityId: admin._id.toString(),
        entityLabel: admin.username,
        summary: `Password admin ${admin.username} direset; sesi lama dicabut`,
        changes: {
          before: { credential: 'Nilai tidak dicatat', tokenVersion: previousTokenVersion },
          after: { credential: 'Diperbarui; nilai disembunyikan', tokenVersion: admin.tokenVersion },
        },
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

    const accountRoles = normalizeUserRoles(admin.role, admin.roles);
    const accountRole = getPrimaryRole(accountRoles);
    if (!isActive && accountRoles.includes('admin') && admin.isActive !== false) {
      const otherAccounts = await User.find({ _id: { $ne: admin._id }, isActive: { $ne: false } })
        .select('role roles')
        .lean();
      if (!otherAccounts.some((account) => normalizeUserRoles(account.role, account.roles).includes('admin'))) {
        return NextResponse.json({ error: 'Minimal harus ada satu admin aktif' }, { status: 400 });
      }
    }

    const previousIsActive = admin.isActive !== false;
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
      changes: { before: { isActive: previousIsActive }, after: { isActive: admin.isActive } },
    });

    return NextResponse.json({ message: `Admin ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui status admin' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID akun wajib diisi' }, { status: 400 });
    }

    await connectDB();
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    }

    const targetRoles = normalizeUserRoles(targetUser.role, targetUser.roles);
    if (targetRoles.includes('admin')) {
      return NextResponse.json({ error: 'Akun yang memiliki role admin tidak dapat dihapus' }, { status: 400 });
    }

    const actor = await getCurrentUser();
    const deleted = await User.findByIdAndDelete(id);
      if (!deleted) {
      return NextResponse.json({ error: 'Gagal menghapus akun user' }, { status: 500 });
    }

    await writeAuditLog({
      actorUsername: actor?.username || 'Admin',
      action: 'user.deleted',
      entityType: 'admin',
      entityId: deleted._id.toString(),
      entityLabel: deleted.username,
      summary: `Akun ${targetRoles.join(' + ')} ${deleted.username} dihapus oleh admin`,
      changes: { before: { username: deleted.username, roles: targetRoles.join(', '), isActive: deleted.isActive }, after: null },
    });

    return NextResponse.json({ message: 'Akun non-admin berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus akun user' }, { status: 500 });
  }
}