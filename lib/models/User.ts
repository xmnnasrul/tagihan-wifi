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
  createdAt: { type: Date, default: Date.now },
});

const cachedUserModel = models.User as Model<IUser> | undefined;
if (cachedUserModel && (!cachedUserModel.schema.path('profileImage')
  || !cachedUserModel.schema.path('originalProfileImage')
  || cachedUserModel.schema.path('chatKeyVersion')
  || cachedUserModel.schema.path('bio'))) {
  delete models.User;
}

const User: Model<IUser> = (models.User as Model<IUser> | undefined) || model<IUser>('User', UserSchema);

export default User;
