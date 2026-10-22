import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });

    await connectDB();
    const account = await User.findOne({ username: currentUser.username, isActive: { $ne: false } })
      .select('originalProfileImage')
      .lean();
    const match = account?.originalProfileImage?.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return NextResponse.json({ error: 'Upload foto profil' }, { status: 404 });

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
    console.error('GET /api/auth/me/profile-image/original failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil foto sumber' }, { status: 500 });
  }
}