import { NextResponse } from 'next/server';

export async function GET() {
  const openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: 'SaaS de Transporte Escolar — Agent Tools Contract API',
      version: '1.0.0',
      description:
        'Contrato determinístico de endpoints internos (Tools) e eventos proativos (Outbox) para o futuro Agente de IA.',
    },
    components: {
      securitySchemes: {
        ServiceTokenBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Header Authorization: Bearer <AGENT_SERVICE_TOKEN>',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['ok', 'errorCode'],
          properties: {
            ok: { type: 'boolean', enum: [false] },
            errorCode: {
              type: 'string',
              enum: [
                'UNAUTHORIZED_SERVICE_TOKEN',
                'VALIDATION_ERROR',
                'VIAGEM_NAO_ENCONTRADA',
                'VIAGEM_NAO_ATIVA',
                'PARADA_NAO_ENCONTRADA',
                'PARADA_JA_CONCLUIDA',
                'RESPONSAVEL_NAO_ENCONTRADO',
                'ALUNO_NAO_ENCONTRADO',
                'FATURA_NAO_ENCONTRADA',
                'FATURA_JA_PAGA',
                'FATURA_CANCELADA',
              ],
            },
          },
        },
      },
    },
    security: [{ ServiceTokenBearer: [] }],
    paths: {
      '/api/tools/registrar-ausencia': {
        post: {
          summary: 'Registra ausência de aluno e reotimiza a rota da viagem ativa',
          operationId: 'registrarAusencia',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['viagemId', 'alunoId'],
                  properties: {
                    viagemId: { type: 'string', format: 'uuid' },
                    alunoId: { type: 'string', format: 'uuid' },
                    origem: { type: 'string', default: 'agent_tool' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Parada marcada como ausente e rota recalculada com etaDelta',
            },
            '404': { description: 'VIAGEM_NAO_ENCONTRADA ou PARADA_NAO_ENCONTRADA' },
            '409': { description: 'VIAGEM_NAO_ATIVA ou PARADA_JA_CONCLUIDA' },
          },
        },
      },
      '/api/tools/status-viagem': {
        get: {
          summary: 'Retorna posição atual da van, ETA e parada atual para um aluno',
          operationId: 'statusViagem',
          parameters: [
            {
              name: 'alunoId',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': { description: 'Status determinístico da viagem e ETA do aluno' },
            '404': { description: 'ALUNO_NAO_ENCONTRADO ou VIAGEM_NAO_ENCONTRADA' },
          },
        },
      },
      '/api/tools/fatura': {
        get: {
          summary: 'Lista faturas abertas (pendentes ou vencidas) de um responsável',
          operationId: 'listarFaturasAbertas',
          parameters: [
            {
              name: 'responsavelId',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': { description: 'Lista de faturas abertas com Pix Copia-e-Cola' },
            '404': { description: 'RESPONSAVEL_NAO_ENCONTRADO' },
          },
        },
      },
      '/api/tools/gerar-pix': {
        post: {
          summary: 'Gera nova cobrança ou segunda via Pix atualizada com multa/juros',
          operationId: 'gerarPix',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['faturaId'],
                  properties: {
                    faturaId: { type: 'string', format: 'uuid' },
                    forcarSegundaVia: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Dados Pix gerados (QR Code Base64 + Copia-e-Cola)' },
            '404': { description: 'FATURA_NAO_ENCONTRADA' },
            '409': { description: 'FATURA_JA_PAGA ou FATURA_CANCELADA' },
          },
        },
      },
      '/api/tools/notificar-motorista': {
        post: {
          summary: 'Envia alerta prioritário em tempo real ao PWA do motorista da viagem',
          operationId: 'notificarMotorista',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['viagemId', 'mensagem'],
                  properties: {
                    viagemId: { type: 'string', format: 'uuid' },
                    mensagem: { type: 'string' },
                    urgencia: {
                      type: 'string',
                      enum: ['info', 'alerta', 'critico'],
                    },
                    alunoId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Alerta publicado no canal Realtime do motorista' },
            '404': { description: 'VIAGEM_NAO_ENCONTRADA' },
            '409': { description: 'VIAGEM_NAO_ATIVA' },
          },
        },
      },
      '/api/tools/contexto-responsavel': {
        get: {
          summary: 'Resolve o responsável pelo telefone WhatsApp, seus alunos e rotas',
          operationId: 'contextoResponsavel',
          parameters: [
            {
              name: 'telefone',
              in: 'query',
              required: true,
              schema: { type: 'string', example: '+5511991000001' },
            },
          ],
          responses: {
            '200': { description: 'Dados completos do responsável, filhos e viagens' },
            '404': { description: 'RESPONSAVEL_NAO_ENCONTRADO' },
          },
        },
      },
    },
    'x-proactive-outbox-events': [
      'van_chegando',
      'atraso',
      'rota_alterada',
      'fatura_vencendo',
      'pagamento_confirmado',
    ],
  };

  return NextResponse.json(openApiSpec);
}
