import { Document, Model, Schema, Types, model, models } from 'mongoose';

export interface IAdminChatAttachment {
  uploadId: string;
  size: number;
  totalChunks: number;
  iv: string;
}

export interface IAdminChatMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  participantIds: Types.ObjectId[];
  ciphertext: string;
  iv: string;
  wrappedKeys: { userId: Types.ObjectId; keyId?: string; encryptedKey: string }[];
  deletedFor: Types.ObjectId[];
  isDeleted: boolean;
  readAt: Date | null;
  attachment: IAdminChatAttachment | null;
  createdAt: Date;
  expiresAt: Date;
}

const attachmentSchema = new Schema<IAdminChatAttachment>({
  uploadId: { type: String, required: true },
  size: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  iv: { type: String, required: true },
}, { _id: false });

const AdminChatMessageSchema = new Schema<IAdminChatMessage>({
  senderId: { type: Schema.Types.ObjectId, required: true, index: true },
  recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
  participantIds: { type: [Schema.Types.ObjectId], required: true, index: true },
  ciphertext: { type: String, required: true, maxlength: 40000 },
  iv: { type: String, required: true, maxlength: 64 },
  wrappedKeys: [{
    userId: { type: Schema.Types.ObjectId, required: true },
    keyId: { type: String, maxlength: 64, default: 'primary' },
    encryptedKey: { type: String, required: true, maxlength: 2048 },
  }],
  deletedFor: { type: [Schema.Types.ObjectId], default: [] },
  isDeleted: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  attachment: { type: attachmentSchema, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

AdminChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AdminChatMessageSchema.index({ participantIds: 1, createdAt: 1 });

const AdminChatMessage: Model<IAdminChatMessage> = models.AdminChatMessage
  || model<IAdminChatMessage>('AdminChatMessage', AdminChatMessageSchema);

export default AdminChatMessage;