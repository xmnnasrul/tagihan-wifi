import { Schema, model, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = models.User || model<IUser>('User', UserSchema);

export default User;
