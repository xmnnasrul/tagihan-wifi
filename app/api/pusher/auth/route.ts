import Pusher from 'pusher';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';

const channelPattern = /^private-admin-chat-([a-f\d]{24})$/i;
const socketIdPattern = /^\d+\.\d+$/;

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 });
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_APP_KEY;
  const secret = process.env.PUSHER_APP_SECRET;
  const cluster = process.env.PUSHER_APP_CLUSTER;
  if (!appId || !key || !secret || !cluster) {
    return NextResponse.json({ error: 'Pusher belum dikonfigurasi' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Permintaan autentikasi tidak valid' }, { status: 400 });
  }

  const socketId = formData.get('socket_id');
  const channelName = formData.get('channel_name');
  const channelMatch = typeof channelName === 'string' ? channelName.match(channelPattern) : null;
  if (typeof socketId !== 'string' || !socketIdPattern.test(socketId)
    || typeof channelName !== 'string' || !channelMatch) {
    return NextResponse.json({ error: 'Channel atau socket tidak valid' }, { status: 400 });
  }

  const channelUserId = channelMatch[1];
  try {
    await connectDB();
    const account = await User.findOne({
      username: currentUser.username,
      isActive: { $ne: false },
    }).select('_id chatRecoveryStatus').lean();

    if (!account) {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 401 });
    }
    if (account.chatRecoveryStatus !== 'ready') {
      return NextResponse.json({ error: 'Buat sandi Chat terlebih dahulu untuk menggunakan chat.' }, { status: 403 });
    }
    if (account._id.toString() !== channelUserId) {
      return NextResponse.json({ error: 'Tidak diizinkan mengakses channel ini' }, { status: 403 });
    }

    const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    return NextResponse.json(pusher.authorizeChannel(socketId, channelName), {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengautentikasi channel Pusher' }, { status: 503 });
  }
}
