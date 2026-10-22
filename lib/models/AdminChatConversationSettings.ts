import { Document, Model, Schema, Types, model, models } from 'mongoose';
import { AdminChatWallpaperSelection } from '@/lib/admin-chat-wallpaper';

interface IEncryptedAdminChatWallpaper {
  ciphertext: string;
  iv: string;
  image: string;
  imageIv: string;
  wrappedKeys: { userId: Types.ObjectId; keyId: string; encryptedKey: string }[];
}

export interface IAdminChatConversationSettings extends Document {
  conversationKey: string;
  participantIds: Types.ObjectId[];
  preset: AdminChatWallpaperSelection;
  blur: number;
  brightness: number;
  overlay: number;
  encryptedWallpaper: IEncryptedAdminChatWallpaper | null;
  createdAt: Date;
  updatedAt: Date;
}

const encryptedWallpaperSchema = new Schema<IEncryptedAdminChatWallpaper>({
  ciphertext: { type: String, required: true, maxlength: 4096 },
  iv: { type: String, required: true, maxlength: 32 },
  image: { type: String, required: true, maxlength: 1_500_000 },
  imageIv: { type: String, required: true, maxlength: 32 },
  wrappedKeys: [{
    userId: { type: Schema.Types.ObjectId, required: true },
    keyId: { type: String, required: true, maxlength: 64 },
    encryptedKey: { type: String, required: true, maxlength: 2048 },
  }],
}, { _id: false });

const AdminChatConversationSettingsSchema = new Schema<IAdminChatConversationSettings>({
  conversationKey: { type: String, required: true, unique: true },
  participantIds: { type: [Schema.Types.ObjectId], required: true },
  preset: { type: String, required: true, default: 'none' },
  blur: { type: Number, required: true, default: 0, min: 0, max: 12 },
  brightness: { type: Number, required: true, default: 100, min: 50, max: 125 },
  overlay: { type: Number, required: true, default: 0, min: 0, max: 60 },
  encryptedWallpaper: { type: encryptedWallpaperSchema, default: null },
}, { timestamps: true });

const AdminChatConversationSettings: Model<IAdminChatConversationSettings> = models.AdminChatConversationSettings
  || model<IAdminChatConversationSettings>('AdminChatConversationSettings', AdminChatConversationSettingsSchema);

export default AdminChatConversationSettings;
