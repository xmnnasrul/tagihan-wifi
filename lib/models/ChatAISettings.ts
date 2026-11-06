import { Model, Schema, model, models } from 'mongoose';

export interface IChatAISettings {
  _id: string;
  provider: string;
  baseURL: string;
  model: string;
  encryptedApiKey: string;
  apiKeyIV: string;
  apiKeyAuthTag: string;
  updatedAt: Date;
}

const ChatAISettingsSchema = new Schema<IChatAISettings>({
  _id: { type: String, default: 'global' },
  provider: { type: String, required: true },
  baseURL: { type: String, required: true },
  model: { type: String, required: true },
  encryptedApiKey: { type: String, required: true, select: false },
  apiKeyIV: { type: String, required: true, select: false },
  apiKeyAuthTag: { type: String, required: true, select: false },
  updatedAt: { type: Date, required: true, default: Date.now },
});

const ChatAISettings: Model<IChatAISettings> = models.ChatAISettings
  || model<IChatAISettings>('ChatAISettings', ChatAISettingsSchema);

export default ChatAISettings;
