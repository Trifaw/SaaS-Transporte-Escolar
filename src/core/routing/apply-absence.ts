import { randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import { getRouteProvider, type StopWaypoint } from './route-provider';
import type {
  EventoViagem,
  OutboxEvento,
  StableErrorCode,
} from '@/types/database';

export interface ParadaRemovidaInfo {
  paradaId: string;
  viagemParadaId: string;
  alunoId: string;
  alunoNome: string;
  endereco: string;
  ordemAnterior: number;
}

export interface NovaOrdemItem {
  paradaId: string;
  alunoId: string;
  alunoNome: string;
  endereco: string;
  ordem: number;
  etaPrevisto: string;
  etaMinutos: number;
  janelaInicio: string;
  janelaFim: string;
}

export interface ApplyAbsenceResult {
  ok: boolean;
  idempotent?: boolean;
  paradaRemovida: ParadaRemovidaInfo | null;
  novaOrdem: NovaOrdemItem[];
  etaDelta: number; // Diferença em segundos no tempo total estimado (negativo = economia de tempo)
  versaoRota?: number;
  motivoFalha?: StableErrorCode;
}

/**
 * Núcleo do MVP: Registra ausência de um aluno em uma viagem ativa,
 * reotimiza as paradas pendentes a partir da posição atual da van (respeitando janelas de horário),
 * persiste a nova ordem + novos ETAs de forma transacional e idempotente, e publica no Realtime.
 */
export async function applyAbsence(
  viagemId: string,
  alunoId: string,
  origem: string = 'sistema'
): Promise<ApplyAbsenceResult> {
  return dbStore.withLock(`viagem:${viagemId}`, async () => {
    const state = dbStore.getState();

    // 1. Valida se a viagem existe e está ativa
    const viagem = state.viagens.find((v) => v.id === viagemId);
    if (!viagem) {
      return {
        ok: false,
        paradaRemovida: null,
        novaOrdem: [],
        etaDelta: 0,
        motivoFalha: 'VIAGEM_NAO_ENCONTRADA',
      };
    }

    if (viagem.status !== 'ativa') {
      return {
        ok: false,
        paradaRemovida: null,
        novaOrdem: [],
        etaDelta: 0,
        motivoFalha: 'VIAGEM_NAO_ATIVA',
      };
    }

    // Localiza a parada do aluno na viagem
    const paradaAlvo = state.viagemParadas.find(
      (vp) => vp.viagem_id === viagemId && vp.aluno_id === alunoId
    );

    if (!paradaAlvo) {
      return {
        ok: false,
        paradaRemovida: null,
        novaOrdem: [],
        etaDelta: 0,
        motivoFalha: 'PARADA_NAO_ENCONTRADA',
      };
    }

    const alunoAlvo = state.alunos.find((a) => a.id === alunoId);
    const paradaRemovidaInfo: ParadaRemovidaInfo = {
      paradaId: paradaAlvo.parada_id,
      viagemParadaId: paradaAlvo.id,
      alunoId: paradaAlvo.aluno_id,
      alunoNome: alunoAlvo?.nome ?? 'Aluno',
      endereco: paradaAlvo.endereco,
      ordemAnterior: paradaAlvo.ordem_atual,
    };

    // Caso de Idempotência: parada já estava marcada como ausente
    if (paradaAlvo.status === 'ausente') {
      const pendentesAtuais = state.viagemParadas
        .filter((vp) => vp.viagem_id === viagemId && vp.status === 'pendente')
        .sort((a, b) => a.ordem_atual - b.ordem_atual)
        .map((vp, idx) => {
          const al = state.alunos.find((a) => a.id === vp.aluno_id);
          const etaMs = vp.eta_previsto
            ? new Date(vp.eta_previsto).getTime() - Date.now()
            : 60_000;
          return {
            paradaId: vp.parada_id,
            alunoId: vp.aluno_id,
            alunoNome: al?.nome ?? 'Aluno',
            endereco: vp.endereco,
            ordem: idx + 1,
            etaPrevisto: vp.eta_previsto ?? new Date().toISOString(),
            etaMinutos: Math.max(1, Math.round(etaMs / 60_000)),
            janelaInicio: vp.janela_inicio,
            janelaFim: vp.janela_fim,
          };
        });

      return {
        ok: true,
        idempotent: true,
        paradaRemovida: paradaRemovidaInfo,
        novaOrdem: pendentesAtuais,
        etaDelta: 0,
        versaoRota: viagem.versao_rota,
      };
    }

    // Valida se a parada já foi concluída (van já passou: embarcado ou desembarcado)
    if (paradaAlvo.status === 'embarcado' || paradaAlvo.status === 'desembarcado') {
      return {
        ok: false,
        paradaRemovida: null,
        novaOrdem: [],
        etaDelta: 0,
        motivoFalha: 'PARADA_JA_CONCLUIDA',
      };
    }

    // Determina ponto de origem (posição atual da van ou ponto de partida da rota)
    const rota = state.rotas.find((r) => r.id === viagem.rota_id);
    const escola = state.escolas.find((e) => e.id === rota?.escola_id);

    const origin = {
      lat: viagem.ultima_lat ?? rota?.ponto_partida_lat ?? -23.6075,
      lng: viagem.ultima_lng ?? rota?.ponto_partida_lng ?? -46.6605,
    };

    const destination = {
      lat: escola?.lat ?? -23.6015,
      lng: escola?.lng ?? -46.6652,
    };

    const speedKmh = viagem.ultima_velocidade_kmh ?? 26;
    const referenceDate = new Date();
    const routeProvider = getRouteProvider();

    // Paradas pendentes ANTES da remoção (para calcular etaDelta exato)
    const paradasPendentesAntes = state.viagemParadas
      .filter((vp) => vp.viagem_id === viagemId && vp.status === 'pendente')
      .sort((a, b) => a.ordem_atual - b.ordem_atual);

    const waypointsAntes: StopWaypoint[] = paradasPendentesAntes.map((vp) => ({
      paradaId: vp.parada_id,
      alunoId: vp.aluno_id,
      endereco: vp.endereco,
      lat: vp.lat,
      lng: vp.lng,
      ordemAtual: vp.ordem_atual,
      janelaInicio: vp.janela_inicio,
      janelaFim: vp.janela_fim,
    }));

    const etaAntes = await routeProvider.calculateStopEtas(
      origin,
      waypointsAntes,
      destination,
      referenceDate,
      speedKmh
    );

    // 2. Marca parada como ausente
    const nowIso = referenceDate.toISOString();
    paradaAlvo.status = 'ausente';
    paradaAlvo.origem_ausencia = origem;
    paradaAlvo.concluida_em = nowIso;
    paradaAlvo.eta_previsto = null;
    paradaAlvo.ack_motorista = false;
    paradaAlvo.updated_at = nowIso;

    // 3. Reotimiza a ordem das paradas restantes pendentes a partir da posição atual da van
    const paradasPendentesDepois = paradasPendentesAntes.filter(
      (vp) => vp.aluno_id !== alunoId
    );

    const waypointsDepois: StopWaypoint[] = paradasPendentesDepois.map((vp) => ({
      paradaId: vp.parada_id,
      alunoId: vp.aluno_id,
      endereco: vp.endereco,
      lat: vp.lat,
      lng: vp.lng,
      ordemAtual: vp.ordem_atual,
      janelaInicio: vp.janela_inicio,
      janelaFim: vp.janela_fim,
    }));

    const optimizedResult = await routeProvider.optimizeRemainingStops(
      origin,
      waypointsDepois,
      destination,
      referenceDate,
      speedKmh
    );

    const novaOrdem: NovaOrdemItem[] = optimizedResult.stops.map((computed, idx) => {
      const vp = paradasPendentesDepois.find((p) => p.aluno_id === computed.alunoId)!;
      const al = state.alunos.find((a) => a.id === computed.alunoId);
      const novaPosicaoOrdem = idx + 1;

      // 4. Persiste nova ordem + novo ETA na parada da viagem
      vp.eta_anterior = vp.eta_previsto;
      vp.ordem_atual = novaPosicaoOrdem;
      vp.eta_previsto = computed.etaPrevistoIso;
      vp.distancia_restante_metros = computed.distanciaMetros;
      vp.ack_motorista = false;
      vp.updated_at = nowIso;

      return {
        paradaId: vp.parada_id,
        alunoId: vp.aluno_id,
        alunoNome: al?.nome ?? 'Aluno',
        endereco: vp.endereco,
        ordem: novaPosicaoOrdem,
        etaPrevisto: computed.etaPrevistoIso,
        etaMinutos: computed.etaMinutos,
        janelaInicio: vp.janela_inicio,
        janelaFim: vp.janela_fim,
      };
    });

    const etaDelta =
      optimizedResult.totalDurationSeconds - etaAntes.totalDurationSeconds;

    viagem.versao_rota += 1;
    viagem.eta_destino_final = optimizedResult.etaDestinoFinalIso;
    viagem.updated_at = nowIso;

    // Registra eventos em evento_viagem
    const eventoAusencia: EventoViagem = {
      id: randomUUID(),
      transportador_id: viagem.transportador_id,
      viagem_id: viagem.id,
      aluno_id: alunoId,
      parada_id: paradaAlvo.parada_id,
      tipo: 'ausencia',
      origem,
      payload: {
        alunoNome: paradaRemovidaInfo.alunoNome,
        ordemAnterior: paradaRemovidaInfo.ordemAnterior,
        versaoRota: viagem.versao_rota,
      },
      created_at: nowIso,
    };

    const eventoRotaAlterada: EventoViagem = {
      id: randomUUID(),
      transportador_id: viagem.transportador_id,
      viagem_id: viagem.id,
      aluno_id: alunoId,
      parada_id: paradaAlvo.parada_id,
      tipo: 'rota_alterada',
      origem,
      payload: {
        paradaRemovida: paradaRemovidaInfo,
        novaOrdem,
        etaDelta,
        versaoRota: viagem.versao_rota,
      },
      created_at: nowIso,
    };

    state.eventosViagem.unshift(eventoRotaAlterada, eventoAusencia);

    // Publica evento proativo rota_alterada no outbox_evento (idempotente)
    const idempotencyKey = `rota_alterada:${viagem.id}:aluno:${alunoId}`;
    const alreadyInOutbox = state.outboxEventos.some(
      (o) => o.idempotency_key === idempotencyKey
    );

    if (!alreadyInOutbox) {
      const outboxEntry: OutboxEvento = {
        id: randomUUID(),
        transportador_id: viagem.transportador_id,
        tipo: 'rota_alterada',
        idempotency_key: idempotencyKey,
        payload: {
          viagemId: viagem.id,
          paradaRemovida: paradaRemovidaInfo,
          novaOrdem,
          etaDelta,
          versaoRota: viagem.versao_rota,
        },
        status: 'pending',
        tentativas: 0,
        proximo_retry_em: nowIso,
        processado_em: null,
        erro_detalhe: null,
        created_at: nowIso,
      };
      state.outboxEventos.unshift(outboxEntry);
    }

    // Publica imediatamente no canal Realtime da viagem (<3s requisito de aceite)
    dbStore.publishRealtime(`viagem:${viagem.id}`, 'rota_alterada', {
      viagemId: viagem.id,
      origem,
      paradaRemovida: paradaRemovidaInfo,
      novaOrdem,
      etaDelta,
      versaoRota: viagem.versao_rota,
      requiresAck: true,
      timestamp: nowIso,
    });

    return {
      ok: true,
      idempotent: false,
      paradaRemovida: paradaRemovidaInfo,
      novaOrdem,
      etaDelta,
      versaoRota: viagem.versao_rota,
    };
  });
}
