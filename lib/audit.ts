import { logError } from './logger.ts';
import { connectDB } from '@/lib/mongodb';
import AuditLog, { AuditChanges, AuditEntityType } from '@/lib/models/AuditLog';

interface AuditEvent {
  actorUsername: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes?: AuditChanges;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create(event);
  } catch (error) {
    logError('Failed to write audit log:', error);
  }
}