import { getDb, taskAuditLog, agentAuditLog } from '@hireclaw/db';

export interface AuditEntry {
  entityId: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  stateBefore: string | null;
  stateAfter: string;
  metadata?: Record<string, unknown>;
}

const tableMap = {
  task: taskAuditLog,
  agent: agentAuditLog,
} as const;

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but don't propagate.
 */
export function writeAuditLog(
  tableName: 'task' | 'agent',
  entry: AuditEntry,
): void {
  const db = getDb();
  const table = tableMap[tableName];

  const idColumn = tableName === 'task' ? 'taskId' : 'agentId';

  const record: Record<string, unknown> = {
    [idColumn]: entry.entityId,
    eventType: entry.eventType,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    stateBefore: entry.stateBefore,
    stateAfter: entry.stateAfter,
    metadata: entry.metadata ?? null,
  };

  // Fire-and-forget: don't await, catch errors silently
  db.insert(table)
    .values(record as any)
    .execute()
    .catch((err) => {
      console.error(`[audit] Failed to write ${tableName} audit log:`, err);
    });
}
