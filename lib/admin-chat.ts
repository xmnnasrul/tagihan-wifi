import AdminChatMediaChunk from './models/AdminChatMediaChunk';
import AdminChatConversationSettings from './models/AdminChatConversationSettings';
import AdminChatMessage from './models/AdminChatMessage';
export { ADMIN_CHAT_MAX_ATTACHMENT_SIZE, ADMIN_CHAT_RETENTION_DAYS, ADMIN_CHAT_RETENTION_MS, ADMIN_CHAT_UPLOAD_CHUNK_SIZE, getAdminChatExpiry } from './admin-chat-constants';

let indexesPromise: Promise<void> | null = null;

export async function ensureAdminChatIndexes(): Promise<void> {
  if (!indexesPromise) {
    const currentPromise = Promise.all([
      AdminChatMessage.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      AdminChatMessage.collection.createIndex({ participantIds: 1, createdAt: 1 }),
      AdminChatMediaChunk.collection.createIndex({ uploadId: 1, chunkIndex: 1 }, { unique: true }),
      AdminChatMediaChunk.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      AdminChatConversationSettings.collection.createIndex({ conversationKey: 1 }, { unique: true }),
    ]).then(() => undefined);

    indexesPromise = currentPromise;
    void currentPromise.catch(() => {
      if (indexesPromise === currentPromise) indexesPromise = null;
    });
  }

  await indexesPromise;
}