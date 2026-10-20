import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { faturaQuerySchema } from '@/lib/validations/schemas';
import { dbStore } from '@/lib/db/store';
import { recordLgpdAccessLog } from '@/core/security/lgpd-audit';

export async function GET(request: Request) {
  if (!verifyServiceToken(request.headers.get('authorization'))) {
    return NextResponse.json(
      { ok: false, errorCode: 'UNAUTHORIZED_SERVICE_TOKEN' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = faturaQuerySchema.safeParse({
    responsavelId: searchParams.get('responsavelId'),
  });

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

  const { responsavelId } = parsed.data;
  const state = dbStore.getState();

  const responsavel = state.responsaveis.find((r) => r.id === responsavelId);
  if (!responsavel) {
    return NextResponse.json(
      { ok: false, errorCode: 'RESPONSAVEL_NAO_ENCONTRADO' },
      { status: 404 }
    );
  }

  const faturasAbertas = state.faturas
    .filter(
      (f) =>
        f.responsavel_id === responsavelId &&
        (f.status === 'pendente' || f.status === 'vencida')
    )
    .map((f) => {
      const aluno = state.alunos.find((a) => a.id === f.aluno_id);
      return {
        faturaId: f.id,
        competencia: f.competencia,
        status: f.status,
        dataVencimento: f.data_vencimento,
        valorOriginal: f.valor_original,
        multaAplicada: f.multa_aplicada,
        jurosAplicado: f.juros_aplicado,
        valorTotal: f.valor_total,
        pixCopiaECola: f.pix_copia_e_cola,
        pixQrCodeBase64: f.pix_qr_code_base64,
        aluno: {
          id: f.aluno_id,
          nome: aluno?.nome ?? 'Aluno',
        },
      };
    });

  recordLgpdAccessLog({
    actor: {
      userId: 'agent_service',
      transportadorId: responsavel.transportador_id,
      role: 'agent_service_token',
    },
    recurso: '/api/tools/fatura',
    acao: 'READ_BILLING',
    metadata: { responsavelId, openInvoicesCount: faturasAbertas.length },
  });

  return NextResponse.json({
    ok: true,
    responsavel: {
      id: responsavel.id,
      nome: responsavel.nome,
      telefoneWhatsapp: responsavel.telefone_whatsapp,
    },
    faturasAbertas,
  });
}
