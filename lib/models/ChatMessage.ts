import { Schema, model, models, Model, Types, Document } from 'mongoose';

export type ChatMessageRole = 'user' | 'assistant';

export interface IChatMessage extends Document {
  ownerId: Types.ObjectId;
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
  expiresAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 20000 },
  createdAt: { type: Date, default: Date.now, required: true },
  expiresAt: { type: Date, required: true },
});

ChatMessageSchema.index({ ownerId: 1, createdAt: -1 });
ChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ChatMessage: Model<IChatMessage> = models.ChatMessage
  || model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
