import { NextResponse } from 'next/server';
import { processAsaasPaymentWebhook } from '@/core/finance/billing-service';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Payload JSON inválido' },
      { status: 422 }
    );
  }

  const headers: Record<string, string | null> = {
    'asaas-access-token': request.headers.get('asaas-access-token'),
    'x-webhook-token': request.headers.get('x-webhook-token'),
  };

  const result = await processAsaasPaymentWebhook(
    headers,
    payload as Record<string, unknown>
  );

  if (!result.ok) {
    const status =
      result.errorCode === 'WEBHOOK_UNAUTHORIZED'
        ? 401
        : result.errorCode === 'FATURA_NAO_ENCONTRADA'
        ? 404
        : 409;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
