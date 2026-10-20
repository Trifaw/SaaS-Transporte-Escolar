import { randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import {
  getRouteProvider,
  timeStringToMinutes,
  type StopEtaComputation,
} from './route-provider';
import type { EventoViagem, OutboxEvento, PosicaoVeiculo } from '@/types/database';

export interface GpsPingInput {
  viagemId: string;
  lat: number;
  lng: number;
  velocidadeKmh?: number;
  direcaoGraus?: number;
  precisaoMetros?: number;
  capturadoEm?: string;
}

export interface GpsPingResult {
  ok: boolean;
  errorCode?: 'VIAGEM_NAO_ENCONTRADA' | 'VIAGEM_NAO_ATIVA';
  posicao?: PosicaoVeiculo;
  updatedEtas?: StopEtaComputation[];
  etaDestinoFinal?: string | null;
  eventosDisparados?: Array<{
    tipo: 'van_chegando' | 'atraso';
    alunoId: string;
    paradaId: string;
    etaMinutos: number;
    atrasoMinutos?: number;
  }>;
}

function getMinutesOfDayInSaoPaulo(isoTimestamp: string): number {
  const date = new Date(isoTimestamp);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export async function processGpsPing(input: GpsPingInput): Promise<GpsPingResult> {
  return dbStore.withLock(`viagem:${input.viagemId}`, async () => {
    const state = dbStore.getState();
    const viagem = state.viagens.find((v) => v.id === input.viagemId);

    if (!viagem) {
      return { ok: false, errorCode: 'VIAGEM_NAO_ENCONTRADA' };
    }

    if (viagem.status !== 'ativa') {
      return { ok: false, errorCode: 'VIAGEM_NAO_ATIVA' };
    }

    const tenant = state.transportadores.find((t) => t.id === viagem.transportador_id);
    const rota = state.rotas.find((r) => r.id === viagem.rota_id);
    const escola = state.escolas.find((e) => e.id === rota?.escola_id);

    const nowIso = input.capturadoEm || new Date().toISOString();
    const referenceDate = new Date(nowIso);
    const speedKmh = input.velocidadeKmh ?? 26;

    // 1. Insert telemetry in posicao_veiculo
    const novaPosicao: PosicaoVeiculo = {
      id: randomUUID(),
      transportador_id: viagem.transportador_id,
      viagem_id: viagem.id,
      veiculo_id: viagem.veiculo_id,
      motorista_id: viagem.motorista_id,
      lat: input.lat,
      lng: input.lng,
      velocidade_kmh: speedKmh,
      direcao_graus: input.direcaoGraus ?? 0,
      precisao_metros: input.precisaoMetros ?? 8,
      capturado_em: nowIso,
      created_at: new Date().toISOString(),
    };
    state.posicoesVeiculo.unshift(novaPosicao);

    // 2. Update last known coordinates on viagem
    viagem.ultima_lat = input.lat;
    viagem.ultima_lng = input.lng;
    viagem.ultima_velocidade_kmh = speedKmh;
    viagem.ultima_atualizacao_gps = nowIso;
    viagem.updated_at = new Date().toISOString();

    // 3. Recompute ETAs for pending stops
    const paradasPendentes = state.viagemParadas
      .filter((vp) => vp.viagem_id === viagem.id && vp.status === 'pendente')
      .sort((a, b) => a.ordem_atual - b.ordem_atual);

    const destination = escola
      ? { lat: escola.lat, lng: escola.lng }
      : { lat: -23.6015, lng: -46.6652 };

    const routeProvider = getRouteProvider();
    const etaResult = await routeProvider.calculateStopEtas(
      { lat: input.lat, lng: input.lng },
      paradasPendentes.map((vp) => ({
        paradaId: vp.parada_id,
        alunoId: vp.aluno_id,
        endereco: vp.endereco,
        lat: vp.lat,
        lng: vp.lng,
        ordemAtual: vp.ordem_atual,
        janelaInicio: vp.janela_inicio,
        janelaFim: vp.janela_fim,
      })),
      destination,
      referenceDate,
      speedKmh
    );

    viagem.eta_destino_final = etaResult.etaDestinoFinalIso;

    const vanChegandoLimitMin = tenant?.config_van_chegando_minutos ?? 5;
    const atrasoLimitMin = tenant?.config_atraso_minutos ?? 10;

    const eventosDisparados: NonNullable<GpsPingResult['eventosDisparados']> = [];

    for (const computed of etaResult.stops) {
      const vp = paradasPendentes.find((p) => p.aluno_id === computed.alunoId);
      if (!vp) continue;

      vp.eta_anterior = vp.eta_previsto;
      vp.eta_previsto = computed.etaPrevistoIso;
      vp.distancia_restante_metros = computed.distanciaMetros;
      vp.updated_at = new Date().toISOString();

      // Check van_chegando (<= 5 min configurable)
      if (computed.etaMinutos <= vanChegandoLimitMin) {
        const idempotencyKey = `van_chegando:${viagem.id}:${vp.parada_id}`;
        const alreadySent = state.outboxEventos.some(
          (o) => o.idempotency_key === idempotencyKey
        );

        if (!alreadySent) {
          const evento: EventoViagem = {
            id: randomUUID(),
            transportador_id: viagem.transportador_id,
            viagem_id: viagem.id,
            aluno_id: vp.aluno_id,
            parada_id: vp.parada_id,
            tipo: 'van_chegando',
            origem: 'gps_monitor',
            payload: {
              etaMinutos: computed.etaMinutos,
              distanciaMetros: computed.distanciaMetros,
              etaPrevisto: computed.etaPrevistoIso,
            },
            created_at: new Date().toISOString(),
          };
          state.eventosViagem.unshift(evento);

          const outbox: OutboxEvento = {
            id: randomUUID(),
            transportador_id: viagem.transportador_id,
            tipo: 'van_chegando',
            idempotency_key: idempotencyKey,
            payload: {
              viagemId: viagem.id,
              alunoId: vp.aluno_id,
              paradaId: vp.parada_id,
              etaMinutos: computed.etaMinutos,
              etaPrevisto: computed.etaPrevistoIso,
            },
            status: 'pending',
            tentativas: 0,
            proximo_retry_em: new Date().toISOString(),
            processado_em: null,
            erro_detalhe: null,
            created_at: new Date().toISOString(),
          };
          state.outboxEventos.unshift(outbox);

          eventosDisparados.push({
            tipo: 'van_chegando',
            alunoId: vp.aluno_id,
            paradaId: vp.parada_id,
            etaMinutos: computed.etaMinutos,
          });
        }
      }

      // Check atraso (desvio > X min além da janela_fim)
      const janelaFimMin = timeStringToMinutes(vp.janela_fim);
      const predictedMinOfDay = getMinutesOfDayInSaoPaulo(computed.etaPrevistoIso);
      const atrasoMinutos = predictedMinOfDay - janelaFimMin;

      if (atrasoMinutos > atrasoLimitMin) {
        const idempotencyKey = `atraso:${viagem.id}:${vp.parada_id}`;
        const alreadySent = state.outboxEventos.some(
          (o) => o.idempotency_key === idempotencyKey
        );

        if (!alreadySent) {
          const evento: EventoViagem = {
            id: randomUUID(),
            transportador_id: viagem.transportador_id,
            viagem_id: viagem.id,
            aluno_id: vp.aluno_id,
            parada_id: vp.parada_id,
            tipo: 'atraso',
            origem: 'gps_monitor',
            payload: {
              atrasoMinutos,
              janelaFim: vp.janela_fim,
              etaPrevisto: computed.etaPrevistoIso,
            },
            created_at: new Date().toISOString(),
          };
          state.eventosViagem.unshift(evento);

          const outbox: OutboxEvento = {
            id: randomUUID(),
            transportador_id: viagem.transportador_id,
            tipo: 'atraso',
            idempotency_key: idempotencyKey,
            payload: {
              viagemId: viagem.id,
              alunoId: vp.aluno_id,
              paradaId: vp.parada_id,
              atrasoMinutos,
              janelaFim: vp.janela_fim,
              etaPrevisto: computed.etaPrevistoIso,
            },
            status: 'pending',
            tentativas: 0,
            proximo_retry_em: new Date().toISOString(),
            processado_em: null,
            erro_detalhe: null,
            created_at: new Date().toISOString(),
          };
          state.outboxEventos.unshift(outbox);

          eventosDisparados.push({
            tipo: 'atraso',
            alunoId: vp.aluno_id,
            paradaId: vp.parada_id,
            etaMinutos: computed.etaMinutos,
            atrasoMinutos,
          });
        }
      }
    }

    // 4. Broadcast live position + ETAs on Realtime bus
    dbStore.publishRealtime(`viagem:${viagem.id}`, 'posicao_atualizada', {
      viagemId: viagem.id,
      posicao: novaPosicao,
      etaDestinoFinal: viagem.eta_destino_final,
      stops: etaResult.stops,
      eventosDisparados,
    });

    return {
      ok: true,
      posicao: novaPosicao,
      updatedEtas: etaResult.stops,
      etaDestinoFinal: viagem.eta_destino_final,
      eventosDisparados,
    };
  });
}
