import { Schema, model, Document, models, Model, Types } from 'mongoose';

export interface IPackage extends Document {
  name: string;
  price: number;
  speed: string;
  description: string;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PackageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    speed: { type: String, required: true },
    description: { type: String, default: '' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PackageSchema.index({ price: 1 });
PackageSchema.index({ ownerId: 1, name: 1 }, { unique: true });

const cachedPackageModel = models.Package as Model<IPackage> | undefined;
if (cachedPackageModel && !cachedPackageModel.schema.path('ownerId')) delete models.Package;

const Package: Model<IPackage> = (models.Package as Model<IPackage> | undefined) || model<IPackage>('Package', PackageSchema);

export default Package;
