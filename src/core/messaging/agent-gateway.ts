import { randomUUID } from 'crypto';
import { dbStore } from '@/lib/db/store';
import type { OutboxEvento, Responsavel } from '@/types/database';
import type { NormalizedInboundWhatsAppMessage } from './messaging-provider';

export interface AgentGatewayInboundPayload {
  mensagemLogId: string;
  normalizedMessage: NormalizedInboundWhatsAppMessage;
  responsavel: Responsavel | null;
  transportadorId: string | null;
}

export interface AgentGatewayResponse {
  status: 'recebido';
  protocolId: string;
  handledBy: 'stub';
  receivedAt: string;
  responsavelResolved: boolean;
  responsavelId: string | null;
}

export interface AgentGateway {
  handleInboundMessage(
    payload: AgentGatewayInboundPayload
  ): Promise<AgentGatewayResponse>;
  consumePendingOutboxEvents(limit?: number): Promise<{
    processedCount: number;
    events: OutboxEvento[];
  }>;
}

/**
 * Stub Funcional do AgentGateway (Sem IA / Sem chamadas a LLM).
 * Registra o recebimento do payload normalizado e responde deterministicamente "recebido".
 * A implementação real do Agente será plugada posteriormente via contrato.
 */
export class StubAgentGateway implements AgentGateway {
  public async handleInboundMessage(
    payload: AgentGatewayInboundPayload
  ): Promise<AgentGatewayResponse> {
    const response: AgentGatewayResponse = {
      status: 'recebido',
      protocolId: `gw_stub_${randomUUID().slice(0, 12)}`,
      handledBy: 'stub',
      receivedAt: new Date().toISOString(),
      responsavelResolved: Boolean(payload.responsavel),
      responsavelId: payload.responsavel?.id ?? null,
    };

    const state = dbStore.getState();
    const logItem = state.mensagensLog.find((m) => m.id === payload.mensagemLogId);
    if (logItem) {
      logItem.gateway_response = response as unknown as Record<string, unknown>;
      logItem.updated_at = response.receivedAt;
    }

    return response;
  }

  public async consumePendingOutboxEvents(limit: number = 25): Promise<{
    processedCount: number;
    events: OutboxEvento[];
  }> {
    const state = dbStore.getState();
    const pending = state.outboxEventos
      .filter((e) => e.status === 'pending')
      .slice(0, limit);

    const nowIso = new Date().toISOString();
    for (const ev of pending) {
      ev.status = 'processed';
      ev.tentativas += 1;
      ev.processado_em = nowIso;
    }

    return {
      processedCount: pending.length,
      events: pending,
    };
  }
}

export const agentGateway: AgentGateway = new StubAgentGateway();
