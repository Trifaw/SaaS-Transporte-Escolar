import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import { getMessagingProvider } from '@/core/messaging/messaging-provider';
import { agentGateway } from '@/core/messaging/agent-gateway';
import type { MensagemLog } from '@/types/database';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken =
    process.env.META_WHATSAPP_VERIFY_TOKEN || 'your-meta-webhook-verify-token';

  if (mode === 'subscribe' && token === expectedToken) {
    return new Response(challenge || 'OK', { status: 200 });
  }

  return NextResponse.json(
    { ok: false, errorCode: 'WEBHOOK_UNAUTHORIZED' },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const provider = getMessagingProvider();

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { ok: false, errorCode: 'WEBHOOK_UNAUTHORIZED' },
      { status: 401 }
    );
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', message: 'JSON inválido' },
      { status: 422 }
    );
  }

  const normalized = provider.normalizeInboundWebhook(parsedBody);
  if (!normalized) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: 'NO_INBOUND_MESSAGE_FOUND' },
      { status: 200 }
    );
  }

  const state = dbStore.getState();

  // Resolve o responsável pelo telefone WhatsApp
  const responsavel =
    state.responsaveis.find(
      (r) => r.telefone_whatsapp === normalized.fromPhoneE164
    ) ?? null;

  const nowIso = new Date().toISOString();
  const logEntry: MensagemLog = {
    id: randomUUID(),
    transportador_id:
      responsavel?.transportador_id ?? state.transportadores[0]?.id ?? null,
    responsavel_id: responsavel?.id ?? null,
    direcao: 'inbound',
    telefone: normalized.fromPhoneE164,
    tipo: normalized.messageType,
    template_name: null,
    conteudo: normalized.textBody,
    external_message_id: normalized.externalMessageId,
    status_entrega: 'received',
    tentativas: 1,
    erro_detalhe: null,
    gateway_response: null,
    payload_bruto: parsedBody,
    created_at: nowIso,
    updated_at: nowIso,
  };

  state.mensagensLog.unshift(logEntry);

  // Encaminha o payload normalizado ao AgentGateway (Stub)
  const gatewayRes = await agentGateway.handleInboundMessage({
    mensagemLogId: logEntry.id,
    normalizedMessage: normalized,
    responsavel,
    transportadorId: logEntry.transportador_id,
  });

  return NextResponse.json({
    ok: true,
    mensagemLogId: logEntry.id,
    responsavelId: responsavel?.id ?? null,
    telefoneNormalizado: normalized.fromPhoneE164,
    gateway: gatewayRes,
  });
}
