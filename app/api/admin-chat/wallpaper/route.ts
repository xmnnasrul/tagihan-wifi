import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { ensureAdminChatIndexes } from '@/lib/admin-chat';
import AdminChatConversationSettings from '@/lib/models/AdminChatConversationSettings';
import User from '@/lib/models/User';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { ADMIN_CHAT_WALLPAPERS, AdminChatWallpaperSettings, DEFAULT_ADMIN_CHAT_WALLPAPER } from '@/lib/admin-chat-wallpaper';
import { normalizeUserRoles } from '@/lib/roles';
import { publishAdminChatUpdate } from '@/lib/pusher-events';

export const dynamic = 'force-dynamic';

type ChatUser = {
  _id: mongoose.Types.ObjectId;
  role?: string;
  roles?: string[];
  chatPublicKey?: string;
  chatRecoveryPublicKey?: string;
  chatRecoveryKeyId?: string;
};

function getConversationKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join(':');
}

async function getParticipants(otherUserId: string) {
  if (!mongoose.isValidObjectId(otherUserId)) {
    return { response: NextResponse.json({ error: 'Pilih admin tujuan chat yang valid' }, { status: 400 }) };
  }

  const currentUser = await getCurrentUser();
  const account = await User.findOne({ username: currentUser?.username, isActive: { $ne: false } })
    .select('_id chatPublicKey chatRecoveryPublicKey chatRecoveryKeyId chatRecoveryStatus')
    .lean();
  if (!account) return { response: NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 401 }) };
  if (account.chatRecoveryStatus !== 'ready') {
    return { response: NextResponse.json({ error: 'Buat sandi Chat terlebih dahulu untuk menggunakan chat.' }, { status: 403 }) };
  }

  const otherAdmin = await User.findOne({ _id: otherUserId, isActive: { $ne: false } })
    .select('_id role roles chatPublicKey chatRecoveryPublicKey chatRecoveryKeyId chatRecoveryStatus')
    .lean();
  if (!otherAdmin || !normalizeUserRoles(otherAdmin.role, otherAdmin.roles).includes('admin')) {
    return { response: NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 }) };
  }
  if (otherAdmin.chatRecoveryStatus !== 'ready' || !otherAdmin.chatPublicKey) {
    return { response: NextResponse.json({ error: 'Admin tujuan belum menyiapkan kunci Chat.' }, { status: 409 }) };
  }
  if (!account.chatPublicKey) {
    return { response: NextResponse.json({ error: 'Kunci Chat akun ini belum tersedia.' }, { status: 409 }) };
  }

  return { account, otherAdmin: otherAdmin as ChatUser };
}

function isValidBase64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validateWallpaper(value: unknown, participants: ChatUser[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const wallpaper = value as Record<string, unknown>;
  if (!isValidBase64(wallpaper.ciphertext, 4096)
    || !isValidBase64(wallpaper.iv, 16) || wallpaper.iv.length !== 16
    || !isValidBase64(wallpaper.image, 1_500_000)
    || !isValidBase64(wallpaper.imageIv, 16) || wallpaper.imageIv.length !== 16
    || !Array.isArray(wallpaper.wrappedKeys)
    || wallpaper.wrappedKeys.length < 2 || wallpaper.wrappedKeys.length > 4) return false;

  const expectedKeys = participants.flatMap((participant) => [
    { userId: participant._id.toString(), keyId: 'primary' },
    ...(participant.chatRecoveryPublicKey
      ? [{ userId: participant._id.toString(), keyId: participant.chatRecoveryKeyId || 'recovery' }]
      : []),
  ]);
  const keys = wallpaper.wrappedKeys as Record<string, unknown>[];
  if (keys.some((key) => typeof key.userId !== 'string' || !mongoose.isValidObjectId(key.userId)
    || typeof key.keyId !== 'string' || key.keyId.length > 64
    || !isValidBase64(key.encryptedKey, 2048))
    || new Set(keys.map((key) => `${key.userId}:${key.keyId}`)).size !== keys.length
    || keys.length !== expectedKeys.length) return false;

  return expectedKeys.every((expected) => keys.some((key) => (
    key.userId === expected.userId && key.keyId === expected.keyId
  )));
}

function validateSettings(value: unknown): value is Omit<AdminChatWallpaperSettings, 'encryptedWallpaper'> & {
  encryptedWallpaper: unknown;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  const preset = settings.preset;
  const isPreset = typeof preset === 'string' && Object.hasOwn(ADMIN_CHAT_WALLPAPERS, preset);
  return (isPreset || preset === 'custom' || preset === 'none')
    && Number.isInteger(settings.blur) && Number(settings.blur) >= 0 && Number(settings.blur) <= 12
    && Number.isInteger(settings.brightness) && Number(settings.brightness) >= 50 && Number(settings.brightness) <= 125
    && Number.isInteger(settings.overlay) && Number(settings.overlay) >= 0 && Number(settings.overlay) <= 60
    && (settings.encryptedWallpaper === null || typeof settings.encryptedWallpaper === 'object');
}

export async function GET(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;
    await connectDB();
    await ensureAdminChatIndexes();

    const otherUserId = new URL(request.url).searchParams.get('with') || '';
    const participantResult = await getParticipants(otherUserId);
    if ('response' in participantResult) return participantResult.response;
    const { account, otherAdmin } = participantResult;
    if (account._id.toString() === otherAdmin._id.toString()) {
      return NextResponse.json({ error: 'Tidak dapat membuka chat dengan akun sendiri' }, { status: 400 });
    }

    const conversationKey = getConversationKey(account._id.toString(), otherAdmin._id.toString());
    const settings = await AdminChatConversationSettings.findOne({ conversationKey }).lean();
    const version = settings?.updatedAt.toISOString() || 'default';
    if (new URL(request.url).searchParams.get('since') === version) {
      return NextResponse.json({ unchanged: true, version }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const responseSettings = settings ? {
      preset: settings.preset,
      blur: settings.blur,
      brightness: settings.brightness,
      overlay: settings.overlay,
      encryptedWallpaper: settings.encryptedWallpaper ? {
        ...settings.encryptedWallpaper,
        wrappedKeys: settings.encryptedWallpaper.wrappedKeys.map((key) => ({
          userId: key.userId.toString(),
          keyId: key.keyId,
          encryptedKey: key.encryptedKey,
        })),
      } : null,
    } : DEFAULT_ADMIN_CHAT_WALLPAPER;
    return NextResponse.json({ settings: responseSettings, version }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/admin-chat/wallpaper failed:', error);
    return NextResponse.json({ error: 'Gagal mengambil wallpaper chat' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;
    await connectDB();
    await ensureAdminChatIndexes();

    const body = await request.json() as Record<string, unknown>;
    const otherUserId = typeof body.with === 'string' ? body.with : '';
    const participantResult = await getParticipants(otherUserId);
    if ('response' in participantResult) return participantResult.response;
    const { account, otherAdmin } = participantResult;
    if (account._id.toString() === otherAdmin._id.toString()) {
      return NextResponse.json({ error: 'Tidak dapat mengubah wallpaper chat dengan akun sendiri' }, { status: 400 });
    }

    if (!validateSettings(body.settings)) {
      return NextResponse.json({ error: 'Pengaturan wallpaper tidak valid' }, { status: 400 });
    }
    const settings = body.settings;
    const participants = [account as ChatUser, otherAdmin];
    if (settings.preset === 'custom') {
      if (!validateWallpaper(settings.encryptedWallpaper, participants)) {
        return NextResponse.json({ error: 'Wallpaper gambar terenkripsi tidak valid' }, { status: 400 });
      }
    } else if (settings.encryptedWallpaper !== null) {
      return NextResponse.json({ error: 'Hapus gambar khusus sebelum memilih wallpaper bawaan' }, { status: 400 });
    }

    const conversationKey = getConversationKey(account._id.toString(), otherAdmin._id.toString());
    const saved = await AdminChatConversationSettings.findOneAndUpdate(
      { conversationKey },
      {
        $set: {
          participantIds: participants.map((participant) => participant._id).sort((a, b) => a.toString().localeCompare(b.toString())),
          preset: settings.preset,
          blur: settings.blur,
          brightness: settings.brightness,
          overlay: settings.overlay,
          encryptedWallpaper: settings.encryptedWallpaper === null ? null : {
            ...settings.encryptedWallpaper as Record<string, unknown>,
            wrappedKeys: (settings.encryptedWallpaper as { wrappedKeys: Record<string, unknown>[] }).wrappedKeys.map((key) => ({
              ...key,
              userId: new mongoose.Types.ObjectId(key.userId as string),
            })),
          },
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    await publishAdminChatUpdate([account._id.toString(), otherAdmin._id.toString()]);

    return NextResponse.json({
      version: saved.updatedAt.toISOString(),
      settings: {
        preset: saved.preset,
        blur: saved.blur,
        brightness: saved.brightness,
        overlay: saved.overlay,
        encryptedWallpaper: saved.encryptedWallpaper ? {
          ...saved.encryptedWallpaper,
          wrappedKeys: saved.encryptedWallpaper.wrappedKeys.map((key) => ({
            userId: key.userId.toString(),
            keyId: key.keyId,
            encryptedKey: key.encryptedKey,
          })),
        } : null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('PUT /api/admin-chat/wallpaper failed:', error);
    return NextResponse.json({ error: 'Gagal menyimpan wallpaper chat' }, { status: 500 });
  }
}
