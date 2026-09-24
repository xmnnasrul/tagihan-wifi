import { Schema, model, Document, models, Model, Types } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  address: string;
  packageId: Types.ObjectId;
  createdBy?: string;
  status: 'active' | 'inactive';
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package' },
    createdBy: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 1, address: 1 }, { unique: true });

const Customer: Model<ICustomer> = models.Customer || model<ICustomer>('Customer', CustomerSchema);

export default Customer;
