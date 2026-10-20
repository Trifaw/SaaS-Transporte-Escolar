import { EventEmitter } from 'events';
import type {
  Aluno,
  AlunoResponsavel,
  AuditAccessLog,
  Escola,
  EventoViagem,
  Fatura,
  MensagemLog,
  Motorista,
  OutboxEvento,
  Pagamento,
  Parada,
  PosicaoVeiculo,
  Responsavel,
  Rota,
  Transportador,
  UserRole,
  UsuarioPerfil,
  Veiculo,
  Viagem,
  ViagemParada,
} from '@/types/database';
import { buildSeedDataset } from './seed-data';

export interface DatabaseState {
  transportadores: Transportador[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  escolas: Escola[];
  responsaveis: Responsavel[];
  alunos: Aluno[];
  alunoResponsaveis: AlunoResponsavel[];
  usuarioPerfis: UsuarioPerfil[];
  rotas: Rota[];
  paradas: Parada[];
  viagens: Viagem[];
  viagemParadas: ViagemParada[];
  posicoesVeiculo: PosicaoVeiculo[];
  faturas: Fatura[];
  pagamentos: Pagamento[];
  eventosViagem: EventoViagem[];
  mensagensLog: MensagemLog[];
  outboxEventos: OutboxEvento[];
  auditAccessLogs: AuditAccessLog[];
}

export interface RealtimeBroadcastPayload {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  publishedAt: string;
}

class TransactionalStore {
  private state: DatabaseState;
  private locks = new Map<string, Promise<void>>();
  public readonly realtimeBus = new EventEmitter();

  constructor() {
    this.realtimeBus.setMaxListeners(100);
    this.state = buildSeedDataset();
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public resetToSeed(): void {
    this.state = buildSeedDataset();
    this.locks.clear();
  }

  /**
   * Simulates Postgres `SELECT ... FOR UPDATE` row-level lock on a resource key
   * so concurrent operations (e.g. simultaneous `applyAbsence` calls or duplicate webhooks)
   * execute strictly serialized and transactionally.
   */
  public async withLock<T>(lockKey: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => current);
    this.locks.set(lockKey, chain);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(lockKey) === chain) {
        this.locks.delete(lockKey);
      }
    }
  }

  public publishRealtime(
    channel: string,
    event: string,
    payload: Record<string, unknown>
  ): RealtimeBroadcastPayload {
    const message: RealtimeBroadcastPayload = {
      channel,
      event,
      payload,
      publishedAt: new Date().toISOString(),
    };
    this.realtimeBus.emit(channel, message);
    this.realtimeBus.emit('*', message);
    return message;
  }

  public subscribeRealtime(
    channel: string,
    listener: (msg: RealtimeBroadcastPayload) => void
  ): () => void {
    this.realtimeBus.on(channel, listener);
    return () => {
      this.realtimeBus.off(channel, listener);
    };
  }
}

const globalForStore = globalThis as unknown as {
  __saasTransporteStore?: TransactionalStore;
};

export const dbStore =
  globalForStore.__saasTransporteStore ??
  (globalForStore.__saasTransporteStore = new TransactionalStore());

export interface ActorContext {
  userId: string;
  transportadorId: string;
  role: UserRole | 'agent_service_token';
  motoristaId?: string | null;
  responsavelId?: string | null;
  ipAddress?: string | null;
}

/**
 * Evaluates RLS + LGPD visibility rules for a given minor (aluno) and location context.
 * Mirrors the exact policies in `0002_rls_policies.sql`.
 */
export function canActorAccessMinorData(actor: ActorContext, alunoId: string): boolean {
  const state = dbStore.getState();
  const aluno = state.alunos.find((a) => a.id === alunoId);
  if (!aluno) return false;

  // Tenant isolation check
  if (
    actor.role !== 'agent_service_token' &&
    aluno.transportador_id !== actor.transportadorId
  ) {
    return false;
  }

  if (actor.role === 'transportador' || actor.role === 'agent_service_token') {
    return true;
  }

  if (actor.role === 'motorista') {
    if (!actor.motoristaId) return false;
    // Motorista can only access students assigned to their trips
    return state.viagemParadas.some((vp) => {
      if (vp.aluno_id !== alunoId) return false;
      const viagem = state.viagens.find((v) => v.id === vp.viagem_id);
      return viagem?.motorista_id === actor.motoristaId;
    });
  }

  if (actor.role === 'responsavel') {
    if (!actor.responsavelId) return false;
    // Responsavel can only access students linked via aluno_responsavel
    return state.alunoResponsaveis.some(
      (ar) => ar.aluno_id === alunoId && ar.responsavel_id === actor.responsavelId
    );
  }

  return false;
}
