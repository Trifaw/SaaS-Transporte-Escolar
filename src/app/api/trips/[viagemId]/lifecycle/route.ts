import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbStore } from '@/lib/db/store';

const lifecycleInputSchema = z.object({
  acao: z.enum(['iniciar', 'encerrar']),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ viagemId: string }> }
) {
  const { viagemId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = lifecycleInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  return dbStore.withLock(`viagem:${viagemId}`, () => {
    const state = dbStore.getState();
    const viagem = state.viagens.find((v) => v.id === viagemId);

    if (!viagem) {
      return NextResponse.json(
        { ok: false, errorCode: 'VIAGEM_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    if (parsed.data.acao === 'iniciar') {
      viagem.status = 'ativa';
      viagem.iniciada_em = viagem.iniciada_em ?? nowIso;
      viagem.encerrada_em = null;
      viagem.updated_at = nowIso;
    } else {
      viagem.status = 'concluida';
      viagem.encerrada_em = nowIso;
      viagem.updated_at = nowIso;
    }

    dbStore.publishRealtime(`viagem:${viagem.id}`, 'status_viagem_alterado', {
      viagemId: viagem.id,
      status: viagem.status,
      timestamp: nowIso,
    });

    return NextResponse.json({
      ok: true,
      viagem,
    });
  });
}
