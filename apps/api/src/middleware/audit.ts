import { writeAuditLog, type AuditEntry } from '../services/audit.js';

/**
 * Create a scoped audit logger for a specific table.
 *
 * Usage:
 *   const auditTask = createAuditLog('task');
 *   auditTask({ entityId: taskId, actorId, actorRole: 'hirer', eventType: 'status_change', stateBefore: 'draft', stateAfter: 'agent_assigned' });
 */
export function createAuditLog(tableName: 'task' | 'agent') {
  return (entry: AuditEntry): void => {
    writeAuditLog(tableName, entry);
  };
}

export { writeAuditLog, type AuditEntry } from '../services/audit.js';
