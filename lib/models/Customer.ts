import { Schema, model, Document, models, Model, Types } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  address: string;
  packageId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    address: { type: String, default: '' },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package' },
  },
  { timestamps: true }
);

const Customer: Model<ICustomer> = models.Customer || model<ICustomer>('Customer', CustomerSchema);

export default Customer;
