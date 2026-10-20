import { randomUUID } from 'crypto';
import { dbStore, type ActorContext } from '@/lib/db/store';
import type { AuditAccessLog } from '@/types/database';

export interface LogAccessParams {
  actor: ActorContext;
  alunoId?: string | null;
  recurso: string;
  acao: 'READ_LOCATION' | 'READ_MINOR_PROFILE' | 'WRITE_ABSENCE' | 'READ_BILLING' | 'DENIED_ACCESS';
  metadata?: Record<string, unknown>;
}

/**
 * LGPD Compliance: Records an audit trail entry whenever minor (aluno) personal data
 * or real-time vehicle location is accessed or modified.
 */
export function recordLgpdAccessLog(params: LogAccessParams): AuditAccessLog {
  const entry: AuditAccessLog = {
    id: randomUUID(),
    transportador_id: params.actor.transportadorId,
    actor_id: params.actor.userId,
    actor_role: params.actor.role,
    aluno_id: params.alunoId ?? null,
    recurso: params.recurso,
    acao: params.acao,
    origem_ip: params.actor.ipAddress ?? '127.0.0.1',
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  dbStore.getState().auditAccessLogs.unshift(entry);
  return entry;
}
