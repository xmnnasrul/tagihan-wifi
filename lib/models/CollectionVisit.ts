import { Schema, model, Document, models, Model, Types } from 'mongoose';

export interface ICollectionVisit extends Document {
  customerId: Types.ObjectId;
  month: string;
  year: number;
  collectorUsername: string;
  visitedAt: Date | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionVisitSchema = new Schema<ICollectionVisit>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    collectorUsername: { type: String, required: true },
    visitedAt: { type: Date, default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

CollectionVisitSchema.index({ customerId: 1, month: 1, year: 1 }, { unique: true });

const CollectionVisit: Model<ICollectionVisit> = models.CollectionVisit || model<ICollectionVisit>('CollectionVisit', CollectionVisitSchema);

export default CollectionVisit;