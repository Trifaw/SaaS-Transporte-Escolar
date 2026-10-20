import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '@/lib/db/store';
import {
  SEED_VIAGEM_AGENDADA_ID,
  SEED_VIAGEM_ATIVA_ID,
} from '@/lib/db/seed-data';
import { processGpsPing } from '@/core/routing/eta-monitor';

describe('Fase 2 — Mapeamento, GPS, Cálculo de ETA e Eventos van_chegando / atraso', () => {
  beforeEach(() => {
    dbStore.resetToSeed();
  });

  it('deve gravar posicao_veiculo, atualizar coordenadas da viagem, calcular ETAs e publicar no Realtime', async () => {
    const receivedEvents: unknown[] = [];
    const unsubscribe = dbStore.subscribeRealtime(
      `viagem:${SEED_VIAGEM_ATIVA_ID}`,
      (msg) => {
        receivedEvents.push(msg);
      }
    );

    const res = await processGpsPing({
      viagemId: SEED_VIAGEM_ATIVA_ID,
      lat: -23.6072,
      lng: -46.6611,
      velocidadeKmh: 30,
      direcaoGraus: 310,
      precisaoMetros: 5,
    });

    unsubscribe();

    expect(res.ok).toBe(true);
    expect(res.posicao?.lat).toBe(-23.6072);
    expect(res.updatedEtas).toHaveLength(8); // 10 paradas totais - 2 já embarcadas = 8 pendentes
    expect(receivedEvents).toHaveLength(1);
  });

  it('deve disparar van_chegando quando ETA <= 5 min de forma idempotente (não duplicar no outbox)', async () => {
    // Posição colada na parada #3 (Al. dos Anapurus, 740 -> -23.6071, -46.6612)
    const firstPing = await processGpsPing({
      viagemId: SEED_VIAGEM_ATIVA_ID,
      lat: -23.6071,
      lng: -46.6612,
      velocidadeKmh: 32,
    });

    expect(firstPing.ok).toBe(true);
    const vanChegandoFirst = firstPing.eventosDisparados?.filter(
      (e) => e.tipo === 'van_chegando'
    );
    expect(vanChegandoFirst && vanChegandoFirst.length).toBeGreaterThan(0);

    // Segundo ping 5 segundos depois na mesma posição não deve duplicar van_chegando para as mesmas paradas
    const secondPing = await processGpsPing({
      viagemId: SEED_VIAGEM_ATIVA_ID,
      lat: -23.6071,
      lng: -46.6612,
      velocidadeKmh: 32,
    });

    const vanChegandoSecond = secondPing.eventosDisparados?.filter(
      (e) => e.tipo === 'van_chegando'
    );
    expect(vanChegandoSecond).toHaveLength(0);
  });

  it('deve disparar evento de atraso quando chegada prevista ultrapassa janela_fim + config_atraso_minutos', async () => {
    // Simula ping capturado às 08:00 UTC (480 min), muito acima da janela_fim (06:32 -> 392 min)
    const latePing = await processGpsPing({
      viagemId: SEED_VIAGEM_ATIVA_ID,
      lat: -23.61,
      lng: -46.655,
      velocidadeKmh: 18,
      capturadoEm: '2026-10-19T08:00:00.000Z',
    });

    expect(latePing.ok).toBe(true);
    const atrasos = latePing.eventosDisparados?.filter((e) => e.tipo === 'atraso');
    expect(atrasos && atrasos.length).toBeGreaterThan(0);
  });

  it('deve rejeitar ping GPS em viagem não ativa com código VIAGEM_NAO_ATIVA', async () => {
    const res = await processGpsPing({
      viagemId: SEED_VIAGEM_AGENDADA_ID,
      lat: -23.599,
      lng: -46.6365,
    });

    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('VIAGEM_NAO_ATIVA');
  });
});
