import type { IAdminChatMessage } from './models/AdminChatMessage';

export function serializeAdminChatMessage(message: Pick<IAdminChatMessage, '_id' | 'senderId' | 'recipientId' | 'ciphertext' | 'iv' | 'wrappedKeys' | 'createdAt' | 'expiresAt' | 'attachment'>) {
  return {
    id: message._id.toString(),
    senderId: message.senderId.toString(),
    recipientId: message.recipientId.toString(),
    ciphertext: message.ciphertext,
    iv: message.iv,
    wrappedKeys: message.wrappedKeys.map((key) => ({
      userId: key.userId.toString(),
      keyId: key.keyId || 'primary',
      encryptedKey: key.encryptedKey,
    })),
    createdAt: message.createdAt.toISOString(),
    expiresAt: message.expiresAt.toISOString(),
    attachment: message.attachment ? {
      uploadId: message.attachment.uploadId,
      size: message.attachment.size,
      totalChunks: message.attachment.totalChunks,
      iv: message.attachment.iv,
      url: `/api/admin-chat/media/${message.attachment.uploadId}`,
    } : null,
  };
}