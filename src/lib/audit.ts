'use server';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

/**
 * Logs an action to the auditLogs collection in Firestore.
 * @param params - The parameters for the audit log entry.
 */
export async function logAudit(params: LogAuditParams) {
  try {
    const auditLogRef = collection(db, 'auditLogs');
    const logEntry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp: any } = {
      ...params,
      timestamp: serverTimestamp(),
    };
    await addDoc(auditLogRef, logEntry);
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Depending on requirements, you might want to handle this error more gracefully.
  }
}
