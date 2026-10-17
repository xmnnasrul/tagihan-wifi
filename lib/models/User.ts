import { Schema, model, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
  roles: string[];
  isActive: boolean;
  tokenVersion: number;
  createdAt: Date;
  profileImage: string;
  originalProfileImage: string;
  chatPublicKey: string;
  chatRecoveryPublicKey: string;
  chatRecoveryKeyId: string;
  chatRecoveryCiphertext: string;
  chatRecoverySalt: string;
  chatRecoveryIv: string;
  chatRecoveryStatus: 'none' | 'migrating' | 'ready';
  chatRecoveryPendingPublicKey: string;
  chatRecoveryPendingKeyId: string;
  chatRecoveryPendingCiphertext: string;
  chatRecoveryPendingSalt: string;
  chatRecoveryPendingIv: string;
  bio: string;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  roles: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  profileImage: { type: String, default: '', maxlength: 700000 },
  originalProfileImage: { type: String, default: '', maxlength: 3500000 },
  chatPublicKey: { type: String, default: '', maxlength: 2048 },
  chatRecoveryPublicKey: { type: String, default: '', maxlength: 2048 },
  chatRecoveryKeyId: { type: String, default: '', maxlength: 64 },
  chatRecoveryCiphertext: { type: String, default: '', maxlength: 8192 },
  chatRecoverySalt: { type: String, default: '', maxlength: 128 },
  chatRecoveryIv: { type: String, default: '', maxlength: 64 },
  chatRecoveryStatus: { type: String, enum: ['none', 'migrating', 'ready'], default: 'none' },
  chatRecoveryPendingPublicKey: { type: String, default: '', maxlength: 2048 },
  chatRecoveryPendingKeyId: { type: String, default: '', maxlength: 64 },
  chatRecoveryPendingCiphertext: { type: String, default: '', maxlength: 8192 },
  chatRecoveryPendingSalt: { type: String, default: '', maxlength: 128 },
  chatRecoveryPendingIv: { type: String, default: '', maxlength: 64 },
  bio: { type: String, default: '', maxlength: 160 },
  createdAt: { type: Date, default: Date.now },
});

const cachedUserModel = models.User as Model<IUser> | undefined;
if (cachedUserModel && (!cachedUserModel.schema.path('profileImage')
  || !cachedUserModel.schema.path('originalProfileImage')
  || !cachedUserModel.schema.path('chatRecoveryPublicKey')
  || !cachedUserModel.schema.path('chatRecoveryKeyId')
  || !cachedUserModel.schema.path('chatRecoveryCiphertext')
  || !cachedUserModel.schema.path('chatRecoveryPendingPublicKey')
  || !cachedUserModel.schema.path('chatRecoveryPendingKeyId')
  || !cachedUserModel.schema.path('bio'))) {
  delete models.User;
}

const User: Model<IUser> = (models.User as Model<IUser> | undefined) || model<IUser>('User', UserSchema);

export default User;
