'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { AuditLog, AuditLogAction, AuditLogEntityType } from '@/lib/types';

interface LogAuditParams {
  actorUid: string;
  actorEmail: string | null;
  action: AuditLogAction;
  entityType: AuditLogEntityType;
  entityId: string;
  districtId?: string;
  details?: any;
}

export async function logAudit(params: LogAuditParams) {
  try {
    const logEntry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp: any } = {
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    };
    await adminDb.collection('auditLogs').add(logEntry);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
