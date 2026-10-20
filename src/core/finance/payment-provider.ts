export interface CreatePixChargeInput {
  faturaId: string;
  responsavelNome: string;
  responsavelCpf: string;
  asaasCustomerId?: string | null;
  valorTotal: number;
  dataVencimento: string;
  descricao: string;
}

export interface PixChargeOutput {
  provider: 'asaas' | 'local';
  externalChargeId: string;
  pixTxid: string;
  pixQrCodeBase64: string;
  pixCopiaECola: string;
  pixExpiracaoIso: string;
}

export interface ParsedPaymentWebhook {
  eventId: string;
  eventType:
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_DELETED'
    | string;
  externalPaymentId: string;
  externalReferenceFaturaId?: string | null;
  valorPago: number;
  paidAtIso: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: 'asaas' | 'local';
  createPixCharge(input: CreatePixChargeInput): Promise<PixChargeOutput>;
  verifyWebhookSignature(headers: Record<string, string | null | undefined>): boolean;
  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentWebhook;
}

function generateSvgQrDataUri(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <rect width="200" height="200" fill="#ffffff"/>
    <rect x="16" y="16" width="52" height="52" fill="none" stroke="#0f172a" stroke-width="8"/>
    <rect x="30" y="30" width="24" height="24" fill="#0f172a"/>
    <rect x="132" y="16" width="52" height="52" fill="none" stroke="#0f172a" stroke-width="8"/>
    <rect x="146" y="30" width="24" height="24" fill="#0f172a"/>
    <rect x="16" y="132" width="52" height="52" fill="none" stroke="#0f172a" stroke-width="8"/>
    <rect x="30" y="146" width="24" height="24" fill="#0f172a"/>
    <rect x="82" y="24" width="12" height="12" fill="#0f172a"/>
    <rect x="102" y="36" width="12" height="24" fill="#0f172a"/>
    <rect x="82" y="76" width="36" height="12" fill="#0f172a"/>
    <rect x="24" y="88" width="40" height="12" fill="#0f172a"/>
    <rect x="88" y="98" width="24" height="24" fill="#10b981"/>
    <rect x="128" y="88" width="48" height="12" fill="#0f172a"/>
    <rect x="84" y="136" width="16" height="36" fill="#0f172a"/>
    <rect x="116" y="128" width="24" height="16" fill="#0f172a"/>
    <rect x="148" y="148" width="32" height="32" fill="#0f172a"/>
    <text x="100" y="195" font-family="monospace" font-size="9" text-anchor="middle" fill="#334155">${label.slice(0, 22)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

export class LocalDeterministicPaymentProvider implements PaymentProvider {
  public readonly name = 'local' as const;

  public async createPixCharge(input: CreatePixChargeInput): Promise<PixChargeOutput> {
    const cleanId = input.faturaId.replace(/-/g, '').slice(0, 16);
    const amountStr = input.valorTotal.toFixed(2);
    const externalChargeId = `pay_asaas_${cleanId}`;
    const pixTxid = `txid_${cleanId}`;
    const pixCopiaECola = `00020126580014br.gov.bcb.pix0136${input.faturaId}520400005303986540${amountStr.length}${amountStr}5802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***6304B1C2`;

    return {
      provider: 'local',
      externalChargeId,
      pixTxid,
      pixQrCodeBase64: generateSvgQrDataUri(`PIX R$ ${amountStr}`),
      pixCopiaECola,
      pixExpiracaoIso: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
  }

  public verifyWebhookSignature(
    headers: Record<string, string | null | undefined>
  ): boolean {
    const token =
      headers['asaas-access-token'] ||
      headers['Asaas-Access-Token'] ||
      headers['x-webhook-token'];
    const expected =
      process.env.ASAAS_WEBHOOK_TOKEN || 'your-asaas-webhook-access-token';
    return Boolean(token && token === expected);
  }

  public parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentWebhook {
    const paymentObj = (payload.payment || {}) as Record<string, unknown>;
    const eventId = String(
      payload.id || `evt_${paymentObj.id || 'unknown'}_${payload.event || 'CONFIRMED'}`
    );
    const eventType = String(payload.event || 'PAYMENT_CONFIRMED');
    const externalPaymentId = String(paymentObj.id || '');
    const externalReferenceFaturaId = paymentObj.externalReference
      ? String(paymentObj.externalReference)
      : null;
    const valorPago = Number(paymentObj.value ?? paymentObj.netValue ?? 0);

    return {
      eventId,
      eventType,
      externalPaymentId,
      externalReferenceFaturaId,
      valorPago,
      paidAtIso: String(
        paymentObj.paymentDate || paymentObj.confirmedDate || new Date().toISOString()
      ),
      rawPayload: payload,
    };
  }
}

export class AsaasPaymentProvider implements PaymentProvider {
  public readonly name = 'asaas' as const;
  private readonly fallback = new LocalDeterministicPaymentProvider();

  public async createPixCharge(input: CreatePixChargeInput): Promise<PixChargeOutput> {
    const apiKey = process.env.ASAAS_API_KEY;
    const baseUrl = process.env.ASAAS_API_BASE_URL || 'https://sandbox.asaas.com/api/v3';

    if (!apiKey || apiKey === 'your-asaas-api-key') {
      return this.fallback.createPixCharge(input);
    }

    try {
      const createRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: apiKey,
        },
        body: JSON.stringify({
          customer: input.asaasCustomerId || 'cus_000000000001',
          billingType: 'PIX',
          value: input.valorTotal,
          dueDate: input.dataVencimento,
          description: input.descricao,
          externalReference: input.faturaId,
        }),
      });

      if (!createRes.ok) {
        return this.fallback.createPixCharge(input);
      }

      const paymentData = await createRes.json();
      const paymentId = String(paymentData.id);

      const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
        headers: { access_token: apiKey },
      });

      if (!qrRes.ok) {
        return this.fallback.createPixCharge(input);
      }

      const qrData = await qrRes.json();
      return {
        provider: 'asaas',
        externalChargeId: paymentId,
        pixTxid: `txid_${paymentId}`,
        pixQrCodeBase64: `data:image/png;base64,${qrData.encodedImage}`,
        pixCopiaECola: String(qrData.payload),
        pixExpiracaoIso: String(
          qrData.expirationDate || new Date(Date.now() + 86400_000).toISOString()
        ),
      };
    } catch {
      return this.fallback.createPixCharge(input);
    }
  }

  public verifyWebhookSignature(
    headers: Record<string, string | null | undefined>
  ): boolean {
    return this.fallback.verifyWebhookSignature(headers);
  }

  public parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentWebhook {
    return this.fallback.parseWebhookEvent(payload);
  }
}

export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER_MODE || 'local';
  if (mode === 'asaas') {
    return new AsaasPaymentProvider();
  }
  return new LocalDeterministicPaymentProvider();
}
