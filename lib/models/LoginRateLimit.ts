import { Document, Model, model, models, Schema } from 'mongoose';

export interface ILoginRateLimit extends Document {
  key: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
}

const LoginRateLimitSchema = new Schema<ILoginRateLimit>({
  key: { type: String, required: true },
  count: { type: Number, required: true, default: 0 },
  windowStartedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

LoginRateLimitSchema.index({ key: 1 }, { unique: true });
LoginRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginRateLimit = (models.LoginRateLimit as Model<ILoginRateLimit> | undefined)
  || model<ILoginRateLimit>('LoginRateLimit', LoginRateLimitSchema);

export default LoginRateLimit;