import { Schema, model, Document, models, Model, Types } from 'mongoose';

export const LEGACY_DATA_OWNER_ID = '6ab3754d75400e992aad5eba';

export interface ICustomer extends Document {
  name: string;
  address: string;
  phone: string;
  packageId: Types.ObjectId;
  ownerId: Types.ObjectId;
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
    phone: { type: String, default: '', trim: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CustomerSchema.index({ ownerId: 1, name: 1, address: 1 }, { unique: true });

const cachedCustomerModel = models.Customer as Model<ICustomer> | undefined;
if (cachedCustomerModel && !cachedCustomerModel.schema.path('ownerId')) delete models.Customer;

const Customer: Model<ICustomer> = (models.Customer as Model<ICustomer> | undefined) || model<ICustomer>('Customer', CustomerSchema);

export default Customer;
