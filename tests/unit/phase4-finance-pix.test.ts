import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '@/lib/db/store';
import {
  calculateLateCharges,
  generateOrRefreshPixCharge,
  processAsaasPaymentWebhook,
} from '@/core/finance/billing-service';

describe('Fase 4 — Financeiro Pix (Asaas) e Webhook Idempotente', () => {
  const validToken = 'your-asaas-webhook-access-token';

  beforeEach(() => {
    dbStore.resetToSeed();
  });

  it('1. Deve gerar QR Code Pix + Copia-e-Cola e calcular multa/juros para fatura vencida', async () => {
    const breakdown = calculateLateCharges(
      480.0,
      '2026-10-01',
      2.0,
      1.0,
      new Date('2026-10-16T12:00:00Z')
    );

    expect(breakdown.diasAtraso).toBe(14);
    expect(breakdown.multaAplicada).toBe(9.6); // 2% de 480
    expect(breakdown.jurosAplicado).toBeGreaterThan(0);
    expect(breakdown.valorTotal).toBeGreaterThan(489.6);

    const res = await generateOrRefreshPixCharge(
      '99999999-9999-4999-8999-999999999901',
      true
    );
    expect(res.ok).toBe(true);
    expect(res.fatura?.pix_copia_e_cola).toContain('000201');
    expect(res.fatura?.pix_qr_code_base64).toContain('data:image/svg+xml;base64,');
  });

  it('2. Critério de Aceite: Webhook de pagamento reprocessado 2x NÃO duplica baixa nem evento no outbox', async () => {
    const faturaId = '99999999-9999-4999-8999-999999999901';
    const webhookPayload = {
      id: 'evt_asaas_unique_0001',
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_asaas_seed_001',
        externalReference: faturaId,
        value: 480.0,
        paymentDate: '2026-10-19T20:00:00.000Z',
      },
    };

    // 1ª execução do webhook
    const firstCall = await processAsaasPaymentWebhook(
      { 'asaas-access-token': validToken },
      webhookPayload
    );

    expect(firstCall.ok).toBe(true);
    expect(firstCall.idempotent).toBe(false);
    expect(firstCall.fatura?.status).toBe('paga');

    const pagamentosCountAfterFirst = dbStore
      .getState()
      .pagamentos.filter((p) => p.fatura_id === faturaId).length;
    const outboxCountAfterFirst = dbStore
      .getState()
      .outboxEventos.filter(
        (o) =>
          o.tipo === 'pagamento_confirmado' &&
          o.idempotency_key === `pagamento_confirmado:${faturaId}`
      ).length;

    expect(pagamentosCountAfterFirst).toBe(1);
    expect(outboxCountAfterFirst).toBe(1);

    // 2ª execução (reprocessamento idêntico do webhook)
    const secondCall = await processAsaasPaymentWebhook(
      { 'asaas-access-token': validToken },
      webhookPayload
    );

    expect(secondCall.ok).toBe(true);
    expect(secondCall.idempotent).toBe(true);
    expect(secondCall.pagamento?.id).toBe(firstCall.pagamento?.id);

    const pagamentosCountAfterSecond = dbStore
      .getState()
      .pagamentos.filter((p) => p.fatura_id === faturaId).length;
    const outboxCountAfterSecond = dbStore
      .getState()
      .outboxEventos.filter(
        (o) =>
          o.tipo === 'pagamento_confirmado' &&
          o.idempotency_key === `pagamento_confirmado:${faturaId}`
      ).length;

    // Garante que NÃO duplicou registro em pagamento nem evento no outbox
    expect(pagamentosCountAfterSecond).toBe(1);
    expect(outboxCountAfterSecond).toBe(1);
  });

  it('3. Deve rejeitar webhook com token de assinatura inválido (WEBHOOK_UNAUTHORIZED)', async () => {
    const res = await processAsaasPaymentWebhook(
      { 'asaas-access-token': 'token-invalido-hacker' },
      {
        id: 'evt_fake',
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_asaas_seed_001', value: 480 },
      }
    );

    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('WEBHOOK_UNAUTHORIZED');
  });

  it('4. Deve rejeitar geração de nova cobrança Pix para fatura já paga (FATURA_JA_PAGA)', async () => {
    // Fatura 903 já nasce paga no seed
    const res = await generateOrRefreshPixCharge(
      '99999999-9999-4999-8999-999999999903',
      true
    );

    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('FATURA_JA_PAGA');
  });
});
