import { Schema, model, Document, models, Model, Types } from 'mongoose';

export type PaymentStatus = 'TF' | 'Cash' | 'Nyicil' | 'Lunas';

export interface IPaymentHistory {
  amount: number;
  addedAt: Date;
  addedBy: string;
  status: PaymentStatus;
  note: string;
}

export interface IBilling extends Document {
  customerId: Types.ObjectId;
  customerName: string;
  address: string;
  packageName: string;
  packagePrice: number;
  carriedAmount: number;
  totalDue: number;
  paidAmount: number;
  month: string;
  year: number;
  status: PaymentStatus;
  installmentAmount: number;
  note: string;
  paymentHistory: IPaymentHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const BillingSchema = new Schema<IBilling>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    address: { type: String, default: '' },
    packageName: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    carriedAmount: { type: Number, default: 0 },
    totalDue: { type: Number },
    paidAmount: { type: Number, default: 0 },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ['TF', 'Cash', 'Nyicil', 'Lunas'], required: true },
    installmentAmount: { type: Number, default: 0 },
    note: { type: String, default: '' },
    paymentHistory: [{
      amount: { type: Number, required: true },
      addedAt: { type: Date, default: Date.now },
      addedBy: { type: String, default: '' },
      status: { type: String, enum: ['TF', 'Cash', 'Nyicil', 'Lunas'], required: true },
      note: { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

BillingSchema.index({ customerName: 1, month: 1, year: 1 }, { unique: true });

const Billing: Model<IBilling> = models.Billing || model<IBilling>('Billing', BillingSchema);

export default Billing;
