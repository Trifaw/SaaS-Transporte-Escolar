import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '@/lib/db/store';
import {
  SEED_VIAGEM_AGENDADA_ID,
  SEED_VIAGEM_ATIVA_ID,
} from '@/lib/db/seed-data';
import { POST as whatsappWebhookPost } from '@/app/api/webhooks/whatsapp/route';
import { POST as registrarAusenciaPost } from '@/app/api/tools/registrar-ausencia/route';
import { GET as statusViagemGet } from '@/app/api/tools/status-viagem/route';
import { GET as faturaGet } from '@/app/api/tools/fatura/route';
import { POST as gerarPixPost } from '@/app/api/tools/gerar-pix/route';
import { POST as notificarMotoristaPost } from '@/app/api/tools/notificar-motorista/route';
import { GET as contextoResponsavelGet } from '@/app/api/tools/contexto-responsavel/route';
import { GET as openApiGet } from '@/app/api/openapi/route';
import { getMessagingProvider } from '@/core/messaging/messaging-provider';
import { agentGateway } from '@/core/messaging/agent-gateway';

describe('Fase 5 — Mensageria WhatsApp, AgentGateway Stub e Endpoints /api/tools/*', () => {
  const validServiceToken = 'change-me-strong-service-token-min-32-chars';
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${validServiceToken}`,
  };

  beforeEach(() => {
    dbStore.resetToSeed();
  });

  it('1. Webhook WhatsApp: normaliza payload Meta Cloud API, resolve responsável pelo telefone, grava em mensagem_log e encaminha ao AgentGateway Stub ("recebido")', async () => {
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ID',
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [
                  {
                    profile: { name: 'Fernanda Oliveira Costa' },
                    wa_id: '5511991000001',
                  },
                ],
                messages: [
                  {
                    from: '5511991000001',
                    id: 'wamid.HBgNNTUxMTk5MTAwMDAwMRUCABIYFDNB',
                    timestamp: '1760900000',
                    type: 'text',
                    text: { body: 'Bom dia! O Lucas não vai hoje.' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload),
    });

    const res = await whatsappWebhookPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.responsavelId).toBe('55555555-5555-4555-8555-555555555501');
    expect(json.gateway.status).toBe('recebido');
    expect(json.gateway.handledBy).toBe('stub');

    // Verifica que gravou em mensagem_log
    const logs = dbStore.getState().mensagensLog;
    expect(logs).toHaveLength(1);
    expect(logs[0].direcao).toBe('inbound');
    expect(logs[0].conteudo).toBe('Bom dia! O Lucas não vai hoje.');
  });

  it('2. MessagingProvider: envia mensagem/template com retry e grava status de entrega em mensagem_log', async () => {
    const provider = getMessagingProvider();
    const res = await provider.sendMessageWithRetry({
      responsavelId: '55555555-5555-4555-8555-555555555501',
      toPhoneE164: '+5511991000001',
      templateName: 'van_chegando_aviso',
      templateParams: { aluno: 'Lucas', minutos: '4' },
    });

    expect(res.ok).toBe(true);
    expect(res.statusEntrega).toBe('delivered');
    expect(dbStore.getState().mensagensLog[0].direcao).toBe('outbound');
  });

  it('3. Proteção Service Token: rejeita chamadas sem token válido com UNAUTHORIZED_SERVICE_TOKEN', async () => {
    const req = new Request(
      'http://localhost:3000/api/tools/status-viagem?alunoId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      {
        headers: { Authorization: 'Bearer token-errado' },
      }
    );
    const res = await statusViagemGet(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.errorCode).toBe('UNAUTHORIZED_SERVICE_TOKEN');
  });

  it('4. Tool POST /api/tools/registrar-ausencia: recalcula rota e retorna códigos de erro estáveis para falhas', async () => {
    // Sucesso para aluno pendente
    const okReq = new Request('http://localhost:3000/api/tools/registrar-ausencia', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        viagemId: SEED_VIAGEM_ATIVA_ID,
        alunoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
        origem: 'agent_tool',
      }),
    });
    const okRes = await registrarAusenciaPost(okReq);
    const okJson = await okRes.json();
    expect(okRes.status).toBe(200);
    expect(okJson.ok).toBe(true);
    expect(typeof okJson.etaDelta).toBe('number');

    // Erro estável PARADA_JA_CONCLUIDA para aluno que já embarcou (06)
    const doneReq = new Request('http://localhost:3000/api/tools/registrar-ausencia', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        viagemId: SEED_VIAGEM_ATIVA_ID,
        alunoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06',
      }),
    });
    const doneRes = await registrarAusenciaPost(doneReq);
    const doneJson = await doneRes.json();
    expect(doneRes.status).toBe(409);
    expect(doneJson.errorCode).toBe('PARADA_JA_CONCLUIDA');

    // Erro estável VIAGEM_NAO_ATIVA para viagem agendada
    const inactiveReq = new Request(
      'http://localhost:3000/api/tools/registrar-ausencia',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          viagemId: SEED_VIAGEM_AGENDADA_ID,
          alunoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa25',
        }),
      }
    );
    const inactiveRes = await registrarAusenciaPost(inactiveReq);
    const inactiveJson = await inactiveRes.json();
    expect(inactiveRes.status).toBe(409);
    expect(inactiveJson.errorCode).toBe('VIAGEM_NAO_ATIVA');
  });

  it('5. Tools GET /status-viagem, GET /fatura, POST /gerar-pix, POST /notificar-motorista e GET /contexto-responsavel + OpenAPI', async () => {
    // GET /api/tools/contexto-responsavel?telefone=+5511991000001
    const ctxReq = new Request(
      'http://localhost:3000/api/tools/contexto-responsavel?telefone=%2B5511991000001',
      { headers: authHeaders }
    );
    const ctxRes = await contextoResponsavelGet(ctxReq);
    const ctxJson = await ctxRes.json();
    expect(ctxRes.status).toBe(200);
    expect(ctxJson.responsavel.nome).toBe('Fernanda Oliveira Costa');
    expect(ctxJson.alunos).toHaveLength(2); // Irmãos Lucas e Sofia

    // GET /api/tools/status-viagem?alunoId=...
    const stReq = new Request(
      'http://localhost:3000/api/tools/status-viagem?alunoId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      { headers: authHeaders }
    );
    const stRes = await statusViagemGet(stReq);
    const stJson = await stRes.json();
    expect(stRes.status).toBe(200);
    expect(stJson.posicaoVan.veiculoPlaca).toBe('ABC1D23');

    // GET /api/tools/fatura?responsavelId=...
    const fatReq = new Request(
      'http://localhost:3000/api/tools/fatura?responsavelId=55555555-5555-4555-8555-555555555501',
      { headers: authHeaders }
    );
    const fatRes = await faturaGet(fatReq);
    const fatJson = await fatRes.json();
    expect(fatRes.status).toBe(200);
    expect(fatJson.faturasAbertas).toHaveLength(1);

    // POST /api/tools/gerar-pix
    const pixReq = new Request('http://localhost:3000/api/tools/gerar-pix', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        faturaId: '99999999-9999-4999-8999-999999999901',
        forcarSegundaVia: true,
      }),
    });
    const pixRes = await gerarPixPost(pixReq);
    const pixJson = await pixRes.json();
    expect(pixRes.status).toBe(200);
    expect(pixJson.pixCopiaECola).toContain('000201');

    // POST /api/tools/notificar-motorista
    const notReq = new Request('http://localhost:3000/api/tools/notificar-motorista', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        viagemId: SEED_VIAGEM_ATIVA_ID,
        mensagem: 'Mãe da Sofia pediu para aguardar 1 minuto no portão.',
        urgencia: 'alerta',
      }),
    });
    const notRes = await notificarMotoristaPost(notReq);
    const notJson = await notRes.json();
    expect(notRes.status).toBe(200);
    expect(notJson.ok).toBe(true);

    // Consumo de eventos proativos do Outbox pelo AgentGateway
    const consumed = await agentGateway.consumePendingOutboxEvents();
    expect(consumed.processedCount).toBeGreaterThanOrEqual(0);

    // GET /api/openapi
    const openApiRes = await openApiGet();
    const openApiJson = await openApiRes.json();
    expect(openApiJson.openapi).toBe('3.1.0');
    expect(openApiJson.paths['/api/tools/registrar-ausencia']).toBeDefined();
  });
});
