import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { gerarPixInputSchema } from '@/lib/validations/schemas';
import { generateOrRefreshPixCharge } from '@/core/finance/billing-service';

export async function POST(request: Request) {
  if (!verifyServiceToken(request.headers.get('authorization'))) {
    return NextResponse.json(
      { ok: false, errorCode: 'UNAUTHORIZED_SERVICE_TOKEN' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = gerarPixInputSchema.safeParse(body);

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

  const { faturaId, forcarSegundaVia } = parsed.data;
  const result = await generateOrRefreshPixCharge(faturaId, forcarSegundaVia);

  if (!result.ok || !result.fatura) {
    const status = result.errorCode === 'FATURA_NAO_ENCONTRADA' ? 404 : 409;
    return NextResponse.json(
      {
        ok: false,
        errorCode: result.errorCode,
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    faturaId: result.fatura.id,
    status: result.fatura.status,
    valorTotal: result.fatura.valor_total,
    dataVencimento: result.fatura.data_vencimento,
    pixTxid: result.fatura.pix_txid,
    pixCopiaECola: result.fatura.pix_copia_e_cola,
    pixQrCodeBase64: result.fatura.pix_qr_code_base64,
    pixExpiracao: result.fatura.pix_expiracao,
  });
}
