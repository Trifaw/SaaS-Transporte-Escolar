import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { notificarMotoristaInputSchema } from '@/lib/validations/schemas';
import { dbStore } from '@/lib/db/store';

export async function POST(request: Request) {
  if (!verifyServiceToken(request.headers.get('authorization'))) {
    return NextResponse.json(
      { ok: false, errorCode: 'UNAUTHORIZED_SERVICE_TOKEN' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = notificarMotoristaInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        issues: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  const { viagemId, mensagem, urgencia, alunoId } = parsed.data;
  const state = dbStore.getState();

  const viagem = state.viagens.find((v) => v.id === viagemId);
  if (!viagem) {
    return NextResponse.json(
      { ok: false, errorCode: 'VIAGEM_NAO_ENCONTRADA' },
      { status: 404 }
    );
  }

  if (viagem.status !== 'ativa') {
    return NextResponse.json(
      { ok: false, errorCode: 'VIAGEM_NAO_ATIVA' },
      { status: 409 }
    );
  }

  const motorista = state.motoristas.find((m) => m.id === viagem.motorista_id);
  const broadcast = dbStore.publishRealtime(`viagem:${viagem.id}`, 'alerta_motorista', {
    viagemId: viagem.id,
    motoristaId: viagem.motorista_id,
    motoristaNome: motorista?.nome ?? null,
    mensagem,
    urgencia,
    alunoId: alunoId ?? null,
  });

  return NextResponse.json({
    ok: true,
    viagemId: viagem.id,
    motoristaId: viagem.motorista_id,
    entregueRealtimeEm: broadcast.publishedAt,
    mensagem,
    urgencia,
  });
}
