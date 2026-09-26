import { connectDB } from '@/lib/mongodb';
import AuditLog, { AuditEntityType } from '@/lib/models/AuditLog';

interface AuditEvent {
  actorUsername: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create(event);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}