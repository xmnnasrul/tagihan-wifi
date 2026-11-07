import { Document, Model, Schema, Types, model, models } from 'mongoose';

export interface IChatKnowledge extends Document {
  ownerId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatKnowledgeSchema = new Schema<IChatKnowledge>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 80000 },
}, { timestamps: true });

ChatKnowledgeSchema.index({ ownerId: 1, updatedAt: -1 });

const ChatKnowledge: Model<IChatKnowledge> = models.ChatKnowledge
  || model<IChatKnowledge>('ChatKnowledge', ChatKnowledgeSchema);

export default ChatKnowledge;
