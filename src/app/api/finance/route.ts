import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbStore } from '@/lib/db/store';
import { getCurrentActorContext } from '@/core/security/auth-guard';
import {
  createInvoiceForStudent,
  generateOrRefreshPixCharge,
  processAsaasPaymentWebhook,
  resendBillingReminder,
} from '@/core/finance/billing-service';
import { uuidSchema } from '@/lib/validations/schemas';

export async function GET() {
  const actor = await getCurrentActorContext();
  const state = dbStore.getState();
  const tenant = state.transportadores.find((t) => t.id === actor.transportadorId);

  const faturasEnriquecidas = state.faturas
    .filter((f) => f.transportador_id === actor.transportadorId)
    .filter((f) => {
      if (actor.role === 'responsavel') {
        return f.responsavel_id === actor.responsavelId;
      }
      return true;
    })
    .map((f) => {
      const aluno = state.alunos.find((a) => a.id === f.aluno_id);
      const responsavel = state.responsaveis.find((r) => r.id === f.responsavel_id);
      return {
        ...f,
        aluno_nome: aluno?.nome ?? 'Aluno',
        aluno_serie: aluno?.serie_turma ?? '',
        responsavel_nome: responsavel?.nome ?? 'Responsável',
        responsavel_whatsapp: responsavel?.telefone_whatsapp ?? '',
        responsavel_cpf: responsavel?.cpf ?? '',
      };
    });

  const aReceber = faturasEnriquecidas
    .filter((f) => f.status === 'pendente')
    .reduce((acc, f) => acc + f.valor_total, 0);

  const inadimplencia = faturasEnriquecidas
    .filter((f) => f.status === 'vencida')
    .reduce((acc, f) => acc + f.valor_total, 0);

  const pagosNoMes = faturasEnriquecidas
    .filter((f) => f.status === 'paga')
    .reduce((acc, f) => acc + f.valor_total, 0);

  const alunosDisponiveis = state.alunos
    .filter((a) => a.transportador_id === actor.transportadorId)
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      valor_mensalidade: a.valor_mensalidade,
      dia_vencimento: a.dia_vencimento,
    }));

  return NextResponse.json({
    ok: true,
    tenant,
    kpis: {
      aReceber: Number(aReceber.toFixed(2)),
      inadimplencia: Number(inadimplencia.toFixed(2)),
      pagosNoMes: Number(pagosNoMes.toFixed(2)),
      totalFaturas: faturasEnriquecidas.length,
      inadimplentesCount: faturasEnriquecidas.filter((f) => f.status === 'vencida')
        .length,
    },
    faturas: faturasEnriquecidas,
    pagamentos: state.pagamentos.slice(0, 25),
    alunosDisponiveis,
  });
}

const financeActionSchema = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('gerar_pix'),
    faturaId: uuidSchema,
    forcarSegundaVia: z.boolean().optional().default(true),
  }),
  z.object({
    acao: z.literal('reenviar_cobranca'),
    faturaId: uuidSchema,
  }),
  z.object({
    acao: z.literal('criar_fatura'),
    alunoId: uuidSchema,
    competencia: z.string().regex(/^\d{4}-\d{2}$/),
    dataVencimento: z.string().optional(),
  }),
  z.object({
    acao: z.literal('cancelar_fatura'),
    faturaId: uuidSchema,
  }),
  z.object({
    acao: z.literal('simular_webhook_pix'),
    faturaId: uuidSchema,
  }),
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = financeActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;

  if (data.acao === 'gerar_pix') {
    const res = await generateOrRefreshPixCharge(data.faturaId, data.forcarSegundaVia);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (data.acao === 'reenviar_cobranca') {
    const res = await resendBillingReminder(data.faturaId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (data.acao === 'criar_fatura') {
    const res = await createInvoiceForStudent({
      alunoId: data.alunoId,
      competencia: data.competencia,
      dataVencimento: data.dataVencimento,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (data.acao === 'cancelar_fatura') {
    const state = dbStore.getState();
    const fatura = state.faturas.find((f) => f.id === data.faturaId);
    if (!fatura) {
      return NextResponse.json(
        { ok: false, errorCode: 'FATURA_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }
    if (fatura.status === 'paga') {
      return NextResponse.json(
        { ok: false, errorCode: 'FATURA_JA_PAGA' },
        { status: 409 }
      );
    }
    fatura.status = 'cancelada';
    fatura.updated_at = new Date().toISOString();
    return NextResponse.json({ ok: true, fatura });
  }

  if (data.acao === 'simular_webhook_pix') {
    const state = dbStore.getState();
    const fatura = state.faturas.find((f) => f.id === data.faturaId);
    if (!fatura) {
      return NextResponse.json(
        { ok: false, errorCode: 'FATURA_NAO_ENCONTRADA' },
        { status: 404 }
      );
    }

    const token =
      process.env.ASAAS_WEBHOOK_TOKEN || 'your-asaas-webhook-access-token';
    const res = await processAsaasPaymentWebhook(
      { 'asaas-access-token': token },
      {
        id: `evt_sim_${fatura.id}`,
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: fatura.external_charge_id || `pay_sim_${fatura.id.slice(0, 8)}`,
          externalReference: fatura.id,
          value: fatura.valor_total,
          paymentDate: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
