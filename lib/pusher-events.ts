import Pusher from 'pusher';

const pusherConfig = {
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_APP_KEY,
  secret: process.env.PUSHER_APP_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
};

let pusherInstance: Pusher | null | undefined;
let warnedMissingConfig = false;

function getPusherServer(): Pusher | null {
  if (pusherInstance !== undefined) return pusherInstance;

  const { appId, key, secret, cluster } = pusherConfig;
  if (!appId || !key || !secret || !cluster) {
    pusherInstance = null;
    return pusherInstance;
  }

  pusherInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return pusherInstance;
}

export async function publishAdminChatUpdate(userIds: string[]): Promise<void> {
  const channels = [...new Set(userIds)].map((userId) => `private-admin-chat-${userId}`);
  if (!channels.length) return;

  const pusher = getPusherServer();
  if (!pusher) {
    if (!warnedMissingConfig) {
      console.error('Pusher belum dikonfigurasi; pembaruan chat real-time tidak terkirim.');
      warnedMissingConfig = true;
    }
    return;
  }

  try {
    await pusher.trigger(channels, 'admin-chat:updated', {});
  } catch (error) {
    console.error('Event admin-chat.updated tidak terkirim ke Pusher:', error);
  }
}
