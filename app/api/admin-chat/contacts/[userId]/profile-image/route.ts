import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { normalizeUserRoles } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { userId } = await params;
    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 });
    }
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });

    await connectDB();
    const [viewer, account] = await Promise.all([
      User.findOne({ username: currentUser.username, isActive: { $ne: false } }).select('_id').lean(),
      User.findOne({ _id: userId, isActive: { $ne: false } })
        .select('role roles profileImage originalProfileImage')
        .lean(),
    ]);
    if (!viewer) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 });
    if (!account || account._id.equals(viewer._id)
      || !normalizeUserRoles(account.role, account.roles).includes('admin')) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 });
    }

    const profileImage = account.originalProfileImage || account.profileImage;
    const match = profileImage.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return NextResponse.json({ error: 'Foto profil tidak tersedia' }, { status: 404 });

    const image = Buffer.from(match[1], 'base64');
    return new Response(image, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Length': String(image.length),
        'Content-Type': 'image/jpeg',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('GET /api/admin-chat/contacts/[userId]/profile-image failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil foto profil admin' }, { status: 500 });
  }
}
