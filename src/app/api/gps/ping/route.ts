import { NextResponse } from 'next/server';
import { gpsPingBatchSchema, gpsPingSchema } from '@/lib/validations/schemas';
import { processGpsPing } from '@/core/routing/eta-monitor';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', message: 'JSON inválido' },
      { status: 422 }
    );
  }

  // Support batch offline queue flush or single ping
  if (Array.isArray(body.pings)) {
    const batchParsed = gpsPingBatchSchema.safeParse(body);
    if (!batchParsed.success) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          issues: batchParsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const results = [];
    for (const ping of batchParsed.data.pings) {
      const res = await processGpsPing(ping);
      results.push(res);
    }

    const lastResult = results[results.length - 1];
    return NextResponse.json({
      ok: true,
      processedCount: results.length,
      lastResult,
    });
  }

  const singleParsed = gpsPingSchema.safeParse(body);
  if (!singleParsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        issues: singleParsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  const result = await processGpsPing(singleParsed.data);
  if (!result.ok) {
    const status = result.errorCode === 'VIAGEM_NAO_ENCONTRADA' ? 404 : 409;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
