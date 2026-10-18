export async function publishAdminChatUpdate(userIds: string[]): Promise<void> {
  const socketServerUrl = process.env.SOCKET_SERVER_URL;
  const publishSecret = process.env.SOCKET_PUBLISH_SECRET;
  if (!socketServerUrl || !publishSecret || userIds.length === 0) return;

  try {
    const response = await fetch(new URL('/internal/chat-events', socketServerUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${publishSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'admin-chat.updated', userIds: [...new Set(userIds)] }),
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      console.error('Socket server menolak event admin-chat.updated:', response.status);
    }
  } catch {
    console.error('Event admin-chat.updated tidak terkirim ke socket server');
  }
}