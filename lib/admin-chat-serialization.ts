import type { IAdminChatAttachment } from './models/AdminChatMessage';

interface SerializableAdminChatMessage {
  _id: { toString(): string };
  senderUsername: string;
  text: string;
  createdAt: Date;
  expiresAt: Date;
  attachment: IAdminChatAttachment | null;
}

export function serializeAdminChatMessage(message: SerializableAdminChatMessage) {
  return {
    id: message._id.toString(),
    senderUsername: message.senderUsername,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    expiresAt: message.expiresAt.toISOString(),
    attachment: message.attachment ? {
      uploadId: message.attachment.uploadId,
      fileName: message.attachment.fileName,
      contentType: message.attachment.contentType,
      size: message.attachment.size,
      totalChunks: message.attachment.totalChunks,
      url: `/api/admin-chat/media/${message.attachment.uploadId}`,
    } : null,
  };
}