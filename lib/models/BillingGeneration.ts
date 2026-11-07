import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';

export interface IBillingGeneration extends Document {
  ownerId: Types.ObjectId;
  month: string;
  year: number;
  createdAt: Date;
}

const BillingGenerationSchema = new Schema<IBillingGeneration>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BillingGenerationSchema.index({ ownerId: 1, year: 1, month: 1 }, { unique: true });

const BillingGeneration: Model<IBillingGeneration> = models.BillingGeneration
  || model<IBillingGeneration>('BillingGeneration', BillingGenerationSchema);

export default BillingGeneration;
