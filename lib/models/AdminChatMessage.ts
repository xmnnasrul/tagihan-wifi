import { Document, Model, Schema, model, models } from 'mongoose';

export interface IAdminChatAttachment {
  uploadId: string;
  fileName: string;
  contentType: string;
  size: number;
  totalChunks: number;
}

export interface IAdminChatMessage extends Document {
  senderUsername: string;
  text: string;
  attachment: IAdminChatAttachment | null;
  createdAt: Date;
  expiresAt: Date;
}

const attachmentSchema = new Schema<IAdminChatAttachment>({
  uploadId: { type: String, required: true },
  fileName: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
}, { _id: false });

const AdminChatMessageSchema = new Schema<IAdminChatMessage>({
  senderUsername: { type: String, required: true, maxlength: 32 },
  text: { type: String, default: '', maxlength: 4000 },
  attachment: { type: attachmentSchema, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

AdminChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AdminChatMessageSchema.index({ createdAt: 1 });

const AdminChatMessage: Model<IAdminChatMessage> = models.AdminChatMessage
  || model<IAdminChatMessage>('AdminChatMessage', AdminChatMessageSchema);

export default AdminChatMessage;