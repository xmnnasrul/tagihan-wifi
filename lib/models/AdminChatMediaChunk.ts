import { Document, Model, Schema, model, models } from 'mongoose';

export interface IAdminChatMediaChunk extends Document {
  uploadId: string;
  chunkIndex: number;
  data: Buffer;
  fileName: string;
  contentType: string;
  fileSize: number;
  totalChunks: number;
  expiresAt: Date;
}

const AdminChatMediaChunkSchema = new Schema<IAdminChatMediaChunk>({
  uploadId: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  data: { type: Buffer, required: true },
  fileName: { type: String, required: true, maxlength: 180 },
  contentType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

AdminChatMediaChunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });
AdminChatMediaChunkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminChatMediaChunk: Model<IAdminChatMediaChunk> = models.AdminChatMediaChunk
  || model<IAdminChatMediaChunk>('AdminChatMediaChunk', AdminChatMediaChunkSchema);

export default AdminChatMediaChunk;