import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { dbStore } from '@/lib/db/store';
import { applyAbsence } from '@/core/routing/apply-absence';
import { uuidSchema } from '@/lib/validations/schemas';

const driverStopActionSchema = z.object({
  viagemId: uuidSchema,
  alunoId: uuidSchema.optional(),
  acao: z.enum(['embarcou', 'ausente', 'desembarcou', 'ack_rota']),
  origem: z.string().optional().default('app_motorista'),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = driverStopActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { viagemId, alunoId, acao, origem } = parsed.data;

  // Caso 1: Ausência — delega diretamente ao núcleo applyAbsence()
  if (acao === 'ausente') {
    if (!alunoId) {
      return NextResponse.json(
        { ok: false, errorCode: 'VALIDATION_ERROR', message: 'alunoId é obrigatório' },
        { status: 422 }
      );
    }
    const result = await applyAbsence(viagemId, alunoId, origem);
    if (!result.ok) {
      const status =
        result.motivoFalha === 'VIAGEM_NAO_ENCONTRADA' ||
        result.motivoFalha === 'PARADA_NAO_ENCONTRADA'
          ? 404
          : 409;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  }

  // Caso 2: Confirmação de leitura (ACK) da nova rota pelo motorista
  if (acao === 'ack_rota') {
    return dbStore.withLock(`viagem:${viagemId}`, () => {
      const state = dbStore.getState();
      const nowIso = new Date().toISOString();
      const stops = state.viagemParadas.filter((vp) => vp.viagem_id === viagemId);

      for (const vp of stops) {
        vp.ack_motorista = true;
        vp.ack_em = nowIso;
        vp.updated_at = nowIso;
      }

      dbStore.publishRealtime(`viagem:${viagemId}`, 'ack_motorista_confirmado', {
        viagemId,
        ackEm: nowIso,
      });

      return NextResponse.json({
        ok: true,
        viagemId,
        ackEm: nowIso,
      });
    });
  }

  // Caso 3: Embarcou ou Desembarcou
  if (!alunoId) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', message: 'alunoId é obrigatório' },
      { status: 422 }
    );
  }

  return dbStore.withLock(`viagem:${viagemId}`, () => {
    const state = dbStore.getState();
    const viagem = state.viagens.find((v) => v.id === viagemId);
    if (!viagem) {
      return NextResponse.json(
        { ok: false, motivoFalha: 'VIAGEM_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }
    if (viagem.status !== 'ativa') {
      return NextResponse.json(
        { ok: false, motivoFalha: 'VIAGEM_NAO_ATIVA' },
        { status: 409 }
      );
    }

    const vp = state.viagemParadas.find(
      (p) => p.viagem_id === viagemId && p.aluno_id === alunoId
    );
    if (!vp) {
      return NextResponse.json(
        { ok: false, motivoFalha: 'PARADA_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const novoStatus = acao === 'embarcou' ? 'embarcado' : 'desembarcado';
    vp.status = novoStatus;
    vp.concluida_em = nowIso;
    vp.eta_previsto = null;
    vp.updated_at = nowIso;

    // Atualiza posição da van para o endereço da parada concluída
    viagem.ultima_lat = vp.lat;
    viagem.ultima_lng = vp.lng;
    viagem.ultima_atualizacao_gps = nowIso;

    // Renumera paradas pendentes restantes
    const pendentes = state.viagemParadas
      .filter((p) => p.viagem_id === viagemId && p.status === 'pendente')
      .sort((a, b) => a.ordem_atual - b.ordem_atual);

    pendentes.forEach((p, idx) => {
      p.ordem_atual = idx + 1;
    });

    state.eventosViagem.unshift({
      id: randomUUID(),
      transportador_id: viagem.transportador_id,
      viagem_id: viagem.id,
      aluno_id: alunoId,
      parada_id: vp.parada_id,
      tipo: acao === 'embarcou' ? 'embarque' : 'desembarque',
      origem,
      payload: { status: novoStatus, timestamp: nowIso },
      created_at: nowIso,
    });

    dbStore.publishRealtime(`viagem:${viagemId}`, 'parada_atualizada', {
      viagemId,
      alunoId,
      status: novoStatus,
      timestamp: nowIso,
    });

    return NextResponse.json({
      ok: true,
      parada: vp,
      pendentesRestantes: pendentes.length,
    });
  });
}
