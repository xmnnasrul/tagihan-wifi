import { Schema, model, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
  isActive: boolean;
  tokenVersion: number;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = models.User || model<IUser>('User', UserSchema);

export default User;
