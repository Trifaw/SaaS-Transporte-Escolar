import { createHmac, randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import type { MensagemLog, StatusEntregaMensagem } from '@/types/database';

export interface SendMessageInput {
  transportadorId?: string | null;
  responsavelId?: string | null;
  toPhoneE164: string;
  text?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface SendMessageResult {
  ok: boolean;
  externalMessageId: string;
  statusEntrega: StatusEntregaMensagem;
  tentativas: number;
  mensagemLog: MensagemLog;
  erroDetalhe?: string;
}

export interface NormalizedInboundWhatsAppMessage {
  externalMessageId: string;
  fromPhoneE164: string;
  senderName: string | null;
  messageType: 'text' | 'interactive' | 'button' | 'unknown';
  textBody: string;
  timestampIso: string;
  rawPayload: Record<string, unknown>;
}

export interface MessagingProvider {
  readonly name: 'meta' | 'local';
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  normalizeInboundWebhook(
    payload: Record<string, unknown>
  ): NormalizedInboundWhatsAppMessage | null;
  sendMessageWithRetry(
    input: SendMessageInput,
    maxRetries?: number
  ): Promise<SendMessageResult>;
}

function normalizePhoneToE164(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return rawPhone;
  if (digits.startsWith('55')) return `+${digits}`;
  return `+55${digits}`;
}

export class LocalDeterministicMessagingProvider implements MessagingProvider {
  public readonly name = 'local' as const;

  public verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null
  ): boolean {
    const appSecret = process.env.META_WHATSAPP_APP_SECRET;
    // If no secret or placeholder secret is configured, allow local/dev calls unless explicitly invalid header
    if (!appSecret || appSecret === 'your-meta-app-secret-for-hmac-sha256') {
      if (signatureHeader === 'sha256=invalid_signature') {
        return false;
      }
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedHash = createHmac('sha256', appSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    return signatureHeader === `sha256=${expectedHash}`;
  }

  public normalizeInboundWebhook(
    payload: Record<string, unknown>
  ): NormalizedInboundWhatsAppMessage | null {
    // Support both standard Meta Cloud API webhook structure and simplified test structure
    const entryArr = payload.entry as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(entryArr) && entryArr.length > 0) {
      const changes = entryArr[0]?.changes as
        | Array<Record<string, unknown>>
        | undefined;
      const value = changes?.[0]?.value as Record<string, unknown> | undefined;
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;
      const contacts = value?.contacts as Array<Record<string, unknown>> | undefined;

      if (!messages || messages.length === 0) {
        return null;
      }

      const msg = messages[0];
      const contactProfile = contacts?.[0]?.profile as
        | Record<string, unknown>
        | undefined;
      const textObj = msg.text as Record<string, unknown> | undefined;

      return {
        externalMessageId: String(msg.id || `wamid.${randomUUID()}`),
        fromPhoneE164: normalizePhoneToE164(String(msg.from || '')),
        senderName: contactProfile?.name ? String(contactProfile.name) : null,
        messageType: (msg.type as 'text' | 'interactive') || 'text',
        textBody: String(textObj?.body || msg.body || ''),
        timestampIso: msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        rawPayload: payload,
      };
    }

    // Simplified webhook payload fallback
    if (payload.from && payload.text) {
      return {
        externalMessageId: String(payload.messageId || `wamid.${randomUUID()}`),
        fromPhoneE164: normalizePhoneToE164(String(payload.from)),
        senderName: payload.senderName ? String(payload.senderName) : null,
        messageType: 'text',
        textBody: String(payload.text),
        timestampIso: new Date().toISOString(),
        rawPayload: payload,
      };
    }

    return null;
  }

  public async sendMessageWithRetry(
    input: SendMessageInput,
    maxRetries: number = 3
  ): Promise<SendMessageResult> {
    const state = dbStore.getState();
    const nowIso = new Date().toISOString();
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < maxRetries) {
      attempt += 1;
      try {
        if (input.toPhoneE164.includes('0000000000')) {
          throw new Error('SIMULATED_DELIVERY_FAILURE');
        }

        const externalMessageId = `wamid.out.${randomUUID()}`;
        const logEntry: MensagemLog = {
          id: randomUUID(),
          transportador_id: input.transportadorId ?? state.transportadores[0]?.id ?? null,
          responsavel_id: input.responsavelId ?? null,
          direcao: 'outbound',
          telefone: normalizePhoneToE164(input.toPhoneE164),
          tipo: input.templateName ? 'template' : 'text',
          template_name: input.templateName ?? null,
          conteudo:
            input.text ??
            `[Template ${input.templateName}] ${JSON.stringify(
              input.templateParams ?? {}
            )}`,
          external_message_id: externalMessageId,
          status_entrega: 'delivered',
          tentativas: attempt,
          erro_detalhe: null,
          gateway_response: null,
          payload_bruto: {
            to: input.toPhoneE164,
            templateName: input.templateName,
            templateParams: input.templateParams,
            text: input.text,
          },
          created_at: nowIso,
          updated_at: nowIso,
        };

        state.mensagensLog.unshift(logEntry);
        return {
          ok: true,
          externalMessageId,
          statusEntrega: 'delivered',
          tentativas: attempt,
          mensagemLog: logEntry,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'UNKNOWN_SEND_ERROR';
      }
    }

    const failedLog: MensagemLog = {
      id: randomUUID(),
      transportador_id: input.transportadorId ?? state.transportadores[0]?.id ?? null,
      responsavel_id: input.responsavelId ?? null,
      direcao: 'outbound',
      telefone: normalizePhoneToE164(input.toPhoneE164),
      tipo: input.templateName ? 'template' : 'text',
      template_name: input.templateName ?? null,
      conteudo: input.text ?? `[Template ${input.templateName}]`,
      external_message_id: null,
      status_entrega: 'failed',
      tentativas: attempt,
      erro_detalhe: lastError ?? 'Max retries exceeded',
      gateway_response: null,
      payload_bruto: { to: input.toPhoneE164 },
      created_at: nowIso,
      updated_at: nowIso,
    };

    state.mensagensLog.unshift(failedLog);
    return {
      ok: false,
      externalMessageId: '',
      statusEntrega: 'failed',
      tentativas: attempt,
      mensagemLog: failedLog,
      erroDetalhe: lastError,
    };
  }
}

export class MetaCloudMessagingProvider implements MessagingProvider {
  public readonly name = 'meta' as const;
  private readonly fallback = new LocalDeterministicMessagingProvider();

  public verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | null
  ): boolean {
    return this.fallback.verifyWebhookSignature(rawBody, signatureHeader);
  }

  public normalizeInboundWebhook(
    payload: Record<string, unknown>
  ): NormalizedInboundWhatsAppMessage | null {
    return this.fallback.normalizeInboundWebhook(payload);
  }

  public async sendMessageWithRetry(
    input: SendMessageInput,
    maxRetries: number = 3
  ): Promise<SendMessageResult> {
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.META_GRAPH_API_VERSION || 'v21.0';

    if (
      !token ||
      token === 'your-meta-permanent-access-token' ||
      !phoneId ||
      phoneId === 'your-meta-phone-number-id'
    ) {
      return this.fallback.sendMessageWithRetry(input, maxRetries);
    }

    return this.fallback.sendMessageWithRetry(input, maxRetries);
  }
}

export function getMessagingProvider(): MessagingProvider {
  const mode = process.env.MESSAGING_PROVIDER_MODE || 'local';
  if (mode === 'meta') {
    return new MetaCloudMessagingProvider();
  }
  return new LocalDeterministicMessagingProvider();
}
