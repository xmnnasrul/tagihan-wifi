import { Schema, model, Document, models, Model } from 'mongoose';

export interface IPackage extends Document {
  name: string;
  price: number;
  speed: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const PackageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    speed: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

const Package: Model<IPackage> = models.Package || model<IPackage>('Package', PackageSchema);

export default Package;
