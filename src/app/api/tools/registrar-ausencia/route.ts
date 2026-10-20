import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { registrarAusenciaInputSchema } from '@/lib/validations/schemas';
import { applyAbsence } from '@/core/routing/apply-absence';
import { recordLgpdAccessLog } from '@/core/security/lgpd-audit';
import { SEED_TENANT_ID } from '@/lib/db/seed-data';

export async function POST(request: Request) {
  if (!verifyServiceToken(request.headers.get('authorization'))) {
    return NextResponse.json(
      { ok: false, errorCode: 'UNAUTHORIZED_SERVICE_TOKEN' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registrarAusenciaInputSchema.safeParse(body);

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

  const { viagemId, alunoId, origem } = parsed.data;
  const result = await applyAbsence(viagemId, alunoId, origem);

  recordLgpdAccessLog({
    actor: {
      userId: 'agent_service',
      transportadorId: SEED_TENANT_ID,
      role: 'agent_service_token',
    },
    alunoId,
    recurso: '/api/tools/registrar-ausencia',
    acao: 'WRITE_ABSENCE',
    metadata: { viagemId, ok: result.ok, motivoFalha: result.motivoFalha ?? null },
  });

  if (!result.ok) {
    const status =
      result.motivoFalha === 'VIAGEM_NAO_ENCONTRADA' ||
      result.motivoFalha === 'PARADA_NAO_ENCONTRADA'
        ? 404
        : 409;
    return NextResponse.json(
      {
        ...result,
        errorCode: result.motivoFalha,
      },
      { status }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
