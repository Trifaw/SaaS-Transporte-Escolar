import { randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import { getPaymentProvider } from './payment-provider';
import type {
  Fatura,
  OutboxEvento,
  Pagamento,
  StableErrorCode,
} from '@/types/database';

export interface LateChargesBreakdown {
  diasAtraso: number;
  multaAplicada: number;
  jurosAplicado: number;
  valorTotal: number;
}

export function calculateLateCharges(
  valorOriginal: number,
  dataVencimento: string,
  multaPercentual: number = 2.0,
  jurosMensalPercentual: number = 1.0,
  referenceDate: Date = new Date()
): LateChargesBreakdown {
  const dueMs = new Date(`${dataVencimento}T23:59:59.999Z`).getTime();
  const refMs = referenceDate.getTime();

  if (refMs <= dueMs) {
    return {
      diasAtraso: 0,
      multaAplicada: 0,
      jurosAplicado: 0,
      valorTotal: Number(valorOriginal.toFixed(2)),
    };
  }

  const diasAtraso = Math.max(1, Math.floor((refMs - dueMs) / 86_400_000));
  const multaAplicada = Number(((valorOriginal * multaPercentual) / 100).toFixed(2));
  const jurosDiarioPercent = jurosMensalPercentual / 30;
  const jurosAplicado = Number(
    ((valorOriginal * (jurosDiarioPercent * diasAtraso)) / 100).toFixed(2)
  );
  const valorTotal = Number(
    (valorOriginal + multaAplicada + jurosAplicado).toFixed(2)
  );

  return {
    diasAtraso,
    multaAplicada,
    jurosAplicado,
    valorTotal,
  };
}

export interface GeneratePixResult {
  ok: boolean;
  errorCode?: StableErrorCode;
  fatura?: Fatura;
}

export async function generateOrRefreshPixCharge(
  faturaId: string,
  forcarSegundaVia: boolean = false
): Promise<GeneratePixResult> {
  return dbStore.withLock(`fatura:${faturaId}`, async () => {
    const state = dbStore.getState();
    const fatura = state.faturas.find((f) => f.id === faturaId);

    if (!fatura) {
      return { ok: false, errorCode: 'FATURA_NAO_ENCONTRADA' };
    }

    if (fatura.status === 'paga') {
      return { ok: false, errorCode: 'FATURA_JA_PAGA' };
    }

    if (fatura.status === 'cancelada') {
      return { ok: false, errorCode: 'FATURA_CANCELADA' };
    }

    const tenant = state.transportadores.find((t) => t.id === fatura.transportador_id);
    const responsavel = state.responsaveis.find((r) => r.id === fatura.responsavel_id);
    const aluno = state.alunos.find((a) => a.id === fatura.aluno_id);

    // Recalculate fine/interest if past due date or if forcing 2nd copy
    const breakdown = calculateLateCharges(
      fatura.valor_original,
      fatura.data_vencimento,
      tenant?.config_multa_percentual ?? 2.0,
      tenant?.config_juros_mensal_percentual ?? 1.0
    );

    if (breakdown.diasAtraso > 0 && fatura.status === 'pendente') {
      fatura.status = 'vencida';
    }

    fatura.multa_aplicada = breakdown.multaAplicada;
    fatura.juros_aplicado = breakdown.jurosAplicado;
    fatura.valor_total = breakdown.valorTotal;

    if (
      !forcarSegundaVia &&
      fatura.pix_copia_e_cola &&
      fatura.pix_qr_code_base64 &&
      fatura.external_charge_id
    ) {
      return { ok: true, fatura };
    }

    const provider = getPaymentProvider();
    const pixData = await provider.createPixCharge({
      faturaId: fatura.id,
      responsavelNome: responsavel?.nome ?? 'Responsável',
      responsavelCpf: responsavel?.cpf ?? '000.000.000-00',
      asaasCustomerId: responsavel?.asaas_customer_id,
      valorTotal: fatura.valor_total,
      dataVencimento: fatura.data_vencimento,
      descricao: `Mensalidade Transporte Escolar (${fatura.competencia}) - ${
        aluno?.nome ?? 'Aluno'
      }`,
    });

    fatura.external_charge_id = pixData.externalChargeId;
    fatura.pix_txid = pixData.pixTxid;
    fatura.pix_qr_code_base64 = pixData.pixQrCodeBase64;
    fatura.pix_copia_e_cola = pixData.pixCopiaECola;
    fatura.pix_expiracao = pixData.pixExpiracaoIso;
    fatura.updated_at = new Date().toISOString();

    return { ok: true, fatura };
  });
}

export interface WebhookProcessResult {
  ok: boolean;
  idempotent?: boolean;
  errorCode?: StableErrorCode;
  fatura?: Fatura;
  pagamento?: Pagamento;
}

/**
 * Processa o webhook de confirmação Pix do Asaas de forma 100% idempotente e transacional.
 * Reprocessar o mesmo evento 2x ou N vezes não duplica baixa nem eventos no outbox.
 */
export async function processAsaasPaymentWebhook(
  headers: Record<string, string | null | undefined>,
  payload: Record<string, unknown>
): Promise<WebhookProcessResult> {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhookSignature(headers)) {
    return {
      ok: false,
      errorCode: 'WEBHOOK_UNAUTHORIZED',
    };
  }

  const parsed = provider.parseWebhookEvent(payload);
  const lockKey = `webhook_pix:${
    parsed.externalReferenceFaturaId || parsed.externalPaymentId || parsed.eventId
  }`;

  return dbStore.withLock(lockKey, async () => {
    const state = dbStore.getState();

    // Localiza a fatura por externalReference (fatura.id) ou external_charge_id
    const fatura = state.faturas.find(
      (f) =>
        (parsed.externalReferenceFaturaId &&
          f.id === parsed.externalReferenceFaturaId) ||
        (parsed.externalPaymentId && f.external_charge_id === parsed.externalPaymentId)
    );

    if (!fatura) {
      return {
        ok: false,
        errorCode: 'FATURA_NAO_ENCONTRADA',
      };
    }

    // Verificação de Idempotência: evento ou pagamento já processado anteriormente
    const existingPayment = state.pagamentos.find(
      (p) =>
        p.external_event_id === parsed.eventId ||
        (parsed.externalPaymentId &&
          p.fatura_id === fatura.id &&
          p.external_payment_id === parsed.externalPaymentId)
    );

    if (existingPayment) {
      return {
        ok: true,
        idempotent: true,
        fatura,
        pagamento: existingPayment,
      };
    }

    // Caso o evento seja de confirmação/recebimento de pagamento
    if (
      parsed.eventType === 'PAYMENT_CONFIRMED' ||
      parsed.eventType === 'PAYMENT_RECEIVED'
    ) {
      const nowIso = new Date().toISOString();

      // Se a fatura já estava paga por outro pagamento anterior, garante idempotência
      if (fatura.status === 'paga') {
        const prevPayment = state.pagamentos.find((p) => p.fatura_id === fatura.id);
        return {
          ok: true,
          idempotent: true,
          fatura,
          pagamento: prevPayment,
        };
      }

      const novoPagamento: Pagamento = {
        id: randomUUID(),
        transportador_id: fatura.transportador_id,
        fatura_id: fatura.id,
        external_payment_id: parsed.externalPaymentId || `pay_${randomUUID()}`,
        external_event_id: parsed.eventId,
        valor_pago: parsed.valorPago > 0 ? parsed.valorPago : fatura.valor_total,
        metodo: 'pix',
        status: 'confirmado',
        payload_webhook: parsed.rawPayload,
        confirmado_em: parsed.paidAtIso || nowIso,
        created_at: nowIso,
      };

      state.pagamentos.unshift(novoPagamento);

      fatura.status = 'paga';
      fatura.pago_em = novoPagamento.confirmado_em;
      fatura.updated_at = nowIso;

      // Publica evento proativo pagamento_confirmado no outbox (idempotente)
      const idempotencyKey = `pagamento_confirmado:${fatura.id}`;
      const alreadyInOutbox = state.outboxEventos.some(
        (o) => o.idempotency_key === idempotencyKey
      );

      if (!alreadyInOutbox) {
        const outbox: OutboxEvento = {
          id: randomUUID(),
          transportador_id: fatura.transportador_id,
          tipo: 'pagamento_confirmado',
          idempotency_key: idempotencyKey,
          payload: {
            faturaId: fatura.id,
            pagamentoId: novoPagamento.id,
            responsavelId: fatura.responsavel_id,
            alunoId: fatura.aluno_id,
            valorPago: novoPagamento.valor_pago,
            competencia: fatura.competencia,
            confirmadoEm: novoPagamento.confirmado_em,
          },
          status: 'pending',
          tentativas: 0,
          proximo_retry_em: nowIso,
          processado_em: null,
          erro_detalhe: null,
          created_at: nowIso,
        };
        state.outboxEventos.unshift(outbox);
      }

      dbStore.publishRealtime(`tenant:${fatura.transportador_id}`, 'fatura_atualizada', {
        faturaId: fatura.id,
        status: 'paga',
        valorPago: novoPagamento.valor_pago,
      });

      return {
        ok: true,
        idempotent: false,
        fatura,
        pagamento: novoPagamento,
      };
    }

    if (parsed.eventType === 'PAYMENT_OVERDUE' && fatura.status === 'pendente') {
      fatura.status = 'vencida';
      fatura.updated_at = new Date().toISOString();
    }

    return {
      ok: true,
      idempotent: false,
      fatura,
    };
  });
}

export async function createInvoiceForStudent(params: {
  alunoId: string;
  competencia: string;
  dataVencimento?: string;
}): Promise<GeneratePixResult> {
  const state = dbStore.getState();
  const aluno = state.alunos.find((a) => a.id === params.alunoId);
  if (!aluno) {
    return { ok: false, errorCode: 'ALUNO_NAO_ENCONTRADO' };
  }

  const existing = state.faturas.find(
    (f) =>
      f.aluno_id === params.alunoId &&
      f.competencia === params.competencia &&
      f.status !== 'cancelada'
  );
  if (existing) {
    return generateOrRefreshPixCharge(existing.id, false);
  }

  const vinculo = state.alunoResponsaveis.find((ar) => ar.aluno_id === aluno.id);
  const dueDay = String(aluno.dia_vencimento || 10).padStart(2, '0');
  const dataVencimento = params.dataVencimento || `${params.competencia}-${dueDay}`;
  const nowIso = new Date().toISOString();

  const novaFatura: Fatura = {
    id: randomUUID(),
    transportador_id: aluno.transportador_id,
    responsavel_id:
      vinculo?.responsavel_id ?? '55555555-5555-4555-8555-555555555501',
    aluno_id: aluno.id,
    competencia: params.competencia,
    valor_original: aluno.valor_mensalidade,
    multa_aplicada: 0,
    juros_aplicado: 0,
    valor_total: aluno.valor_mensalidade,
    data_vencimento: dataVencimento,
    status: 'pendente',
    external_charge_id: null,
    pix_txid: null,
    pix_qr_code_base64: null,
    pix_copia_e_cola: null,
    pix_expiracao: null,
    ultima_cobranca_enviada_em: null,
    pago_em: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.faturas.unshift(novaFatura);
  return generateOrRefreshPixCharge(novaFatura.id, true);
}

export async function resendBillingReminder(faturaId: string): Promise<GeneratePixResult> {
  const refreshed = await generateOrRefreshPixCharge(faturaId, false);
  if (!refreshed.ok || !refreshed.fatura) {
    return refreshed;
  }

  const state = dbStore.getState();
  const fatura = refreshed.fatura;
  const nowIso = new Date().toISOString();
  fatura.ultima_cobranca_enviada_em = nowIso;
  fatura.updated_at = nowIso;

  const idempotencyKey = `fatura_vencendo:${fatura.id}:${nowIso.slice(0, 16)}`;
  state.outboxEventos.unshift({
    id: randomUUID(),
    transportador_id: fatura.transportador_id,
    tipo: 'fatura_vencendo',
    idempotency_key: idempotencyKey,
    payload: {
      faturaId: fatura.id,
      responsavelId: fatura.responsavel_id,
      alunoId: fatura.aluno_id,
      valorTotal: fatura.valor_total,
      dataVencimento: fatura.data_vencimento,
      pixCopiaECola: fatura.pix_copia_e_cola,
    },
    status: 'pending',
    tentativas: 0,
    proximo_retry_em: nowIso,
    processado_em: null,
    erro_detalhe: null,
    created_at: nowIso,
  });

  return { ok: true, fatura };
}
