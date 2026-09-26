import { Schema, model, Document, models, Model } from 'mongoose';

export type AuditEntityType = 'billing' | 'customer' | 'package' | 'admin';

export interface IAuditLog extends Document {
  actorUsername: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUsername: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, enum: ['billing', 'customer', 'package', 'admin'], required: true },
    entityId: { type: String, required: true },
    entityLabel: { type: String, required: true },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> = models.AuditLog || model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;