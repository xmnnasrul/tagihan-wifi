import { Schema, model, Document, models, Model } from 'mongoose';

export type AuditEntityType = 'billing' | 'customer' | 'package' | 'admin';
export type AuditValue = string | number | boolean | null;

export interface AuditChanges {
  before: Record<string, AuditValue> | null;
  after: Record<string, AuditValue> | null;
}

export interface IAuditLog extends Document {
  actorUsername: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes?: AuditChanges;
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
    changes: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> = models.AuditLog || model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;