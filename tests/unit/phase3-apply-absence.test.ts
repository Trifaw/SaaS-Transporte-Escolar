import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '@/lib/db/store';
import {
  SEED_VIAGEM_AGENDADA_ID,
  SEED_VIAGEM_ATIVA_ID,
} from '@/lib/db/seed-data';
import { applyAbsence } from '@/core/routing/apply-absence';

describe('Fase 3 — Recálculo de Rota applyAbsence(viagemId, alunoId, origem)', () => {
  beforeEach(() => {
    dbStore.resetToSeed();
  });

  it('1. Caminho feliz: deve remover parada pendente, reotimizar ordem, calcular etaDelta negativo e publicar no Realtime', async () => {
    const realtimeEvents: Array<{ event: string; payload: Record<string, unknown> }> = [];
    const unsubscribe = dbStore.subscribeRealtime(
      `viagem:${SEED_VIAGEM_ATIVA_ID}`,
      (msg) => {
        realtimeEvents.push({ event: msg.event, payload: msg.payload });
      }
    );

    // Aluno 08 está na parada #3 (pendente) da viagem ativa
    const alunoAusenteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08';
    const result = await applyAbsence(
      SEED_VIAGEM_ATIVA_ID,
      alunoAusenteId,
      'whatsapp_responsavel'
    );

    unsubscribe();

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.paradaRemovida?.alunoId).toBe(alunoAusenteId);
    expect(result.novaOrdem).toHaveLength(7); // Eram 8 pendentes -> agora 7 pendentes
    expect(result.etaDelta).toBeLessThan(0); // Economia de tempo ao pular a parada

    // Verifica que as ordens são contíguas (1..7)
    expect(result.novaOrdem.map((s) => s.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // Verifica broadcast Realtime imediato
    expect(realtimeEvents).toHaveLength(1);
    expect(realtimeEvents[0].event).toBe('rota_alterada');
  });

  it('2. Idempotência: chamar applyAbsence 2x para o mesmo aluno não duplica eventos e retorna etaDelta = 0 na segunda chamada', async () => {
    const alunoAusenteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';

    const first = await applyAbsence(SEED_VIAGEM_ATIVA_ID, alunoAusenteId, 'tool');
    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);

    const outboxCountAfterFirst = dbStore
      .getState()
      .outboxEventos.filter((o) => o.tipo === 'rota_alterada').length;

    const second = await applyAbsence(SEED_VIAGEM_ATIVA_ID, alunoAusenteId, 'tool');
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.etaDelta).toBe(0);
    expect(second.novaOrdem).toHaveLength(first.novaOrdem.length);

    const outboxCountAfterSecond = dbStore
      .getState()
      .outboxEventos.filter((o) => o.tipo === 'rota_alterada').length;

    expect(outboxCountAfterSecond).toBe(outboxCountAfterFirst);
  });

  it('3. Ausência após passagem da van: deve retornar PARADA_JA_CONCLUIDA quando o aluno já embarcou/desembarcou', async () => {
    // Aluno 06 está na parada #1 da viagem ativa, que já consta como 'embarcado' no seed
    const alunoJaEmbarcadoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06';

    const result = await applyAbsence(
      SEED_VIAGEM_ATIVA_ID,
      alunoJaEmbarcadoId,
      'whatsapp'
    );

    expect(result.ok).toBe(false);
    expect(result.motivoFalha).toBe('PARADA_JA_CONCLUIDA');
  });

  it('4. Viagem inexistente ou não ativa: deve retornar VIAGEM_NAO_ENCONTRADA e VIAGEM_NAO_ATIVA', async () => {
    const inexistente = await applyAbsence(
      '00000000-0000-4000-8000-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      'tool'
    );
    expect(inexistente.ok).toBe(false);
    expect(inexistente.motivoFalha).toBe('VIAGEM_NAO_ENCONTRADA');

    const naoAtiva = await applyAbsence(
      SEED_VIAGEM_AGENDADA_ID,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa25',
      'tool'
    );
    expect(naoAtiva.ok).toBe(false);
    expect(naoAtiva.motivoFalha).toBe('VIAGEM_NAO_ATIVA');
  });

  it('5. Última parada pendente: deve permitir ausência na última parada restante e retornar novaOrdem vazia', async () => {
    const pendentes = dbStore
      .getState()
      .viagemParadas.filter(
        (vp) => vp.viagem_id === SEED_VIAGEM_ATIVA_ID && vp.status === 'pendente'
      );

    // Marca todas menos a última como embarcadas
    for (let i = 0; i < pendentes.length - 1; i++) {
      pendentes[i].status = 'embarcado';
    }

    const ultimaParada = pendentes[pendentes.length - 1];
    const result = await applyAbsence(
      SEED_VIAGEM_ATIVA_ID,
      ultimaParada.aluno_id,
      'whatsapp'
    );

    expect(result.ok).toBe(true);
    expect(result.paradaRemovida?.alunoId).toBe(ultimaParada.aluno_id);
    expect(result.novaOrdem).toEqual([]);
    expect(result.etaDelta).toBeLessThan(0);
  });

  it('6. Múltiplas ausências simultâneas: deve serializar com lock transacional e manter ordem consistente', async () => {
    const alunosSimultaneos = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
    ];

    const results = await Promise.all(
      alunosSimultaneos.map((alunoId) =>
        applyAbsence(SEED_VIAGEM_ATIVA_ID, alunoId, 'simultaneo')
      )
    );

    for (const r of results) {
      expect(r.ok).toBe(true);
    }

    // Eram 8 pendentes - 3 ausências simultâneas = 5 pendentes restantes
    const pendentesFinais = dbStore
      .getState()
      .viagemParadas.filter(
        (vp) => vp.viagem_id === SEED_VIAGEM_ATIVA_ID && vp.status === 'pendente'
      )
      .sort((a, b) => a.ordem_atual - b.ordem_atual);

    expect(pendentesFinais).toHaveLength(5);
    expect(pendentesFinais.map((p) => p.ordem_atual)).toEqual([1, 2, 3, 4, 5]);
  });
});
