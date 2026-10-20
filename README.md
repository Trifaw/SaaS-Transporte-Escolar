# SaaS de Transporte Escolar — MVP Determinístico

Plataforma SaaS multi-tenant para transportadores escolares no Brasil, construída com **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth, Realtime, RLS) + Zod + Vitest**.

> **Escopo Arquitetural:** Este repositório implementa os módulos determinísticos de missão crítica (rastreamento GPS, recálculo transacional de rotas `applyAbsence`, PWA do motorista, financeiro Pix via Asaas, mensageria WhatsApp via Meta Cloud API e o contrato de Tools OpenAPI). O Agente de IA será acoplado posteriormente via `AgentGateway` e endpoints `/api/tools/*`.

---

## 1. Requisitos e Setup Rápido

### Pré-requisitos
- **Node.js** 20+ (ou 22/24 LTS)
- **Supabase CLI** (opcional para banco Postgres local via Docker; o projeto também inclui store transacional em memória pré-carregada com o seed para execução imediata de testes e simulação sem dependências externas).

### Instalação
```bash
# 1. Instalar dependências
npm install

# 2. Copiar arquivo de variáveis de ambiente
cp .env.example .env.local

# 3. Rodar o servidor de desenvolvimento (http://localhost:3000)
npm run dev
```

---

## 2. Variáveis de Ambiente (`.env.example`)

| Variável | Descrição | Valor Padrão Local |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anônima (RLS ativo) | `your-supabase-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa para webhooks/tools | `your-supabase-service-role-key` |
| `AGENT_SERVICE_TOKEN` | Token Bearer para proteger `/api/tools/*` | `change-me-strong-service-token-min-32-chars` |
| `ROUTE_PROVIDER_MODE` | `"local"` (Haversine + Janelas) ou `"google"` (Routes API v2) | `"local"` |
| `PAYMENT_PROVIDER_MODE` | `"local"` (BRCode determinístico) ou `"asaas"` (Asaas API v3) | `"local"` |
| `MESSAGING_PROVIDER_MODE` | `"local"` ou `"meta"` (Meta WhatsApp Cloud API) | `"local"` |
| `GOOGLE_ROUTES_API_KEY` | Chave de servidor para Google Routes API | — |
| `ASAAS_API_KEY` | Chave da API Asaas para emissão Pix | — |
| `ASAAS_WEBHOOK_TOKEN` | Token de autenticação do webhook Asaas | `your-asaas-webhook-access-token` |
| `META_WHATSAPP_ACCESS_TOKEN` | Token da Meta Cloud API | — |
| `META_WHATSAPP_APP_SECRET` | Segredo do App Meta para validação `X-Hub-Signature-256` | — |

---

## 3. Banco de Dados (Supabase Migrations & Seed)

Os arquivos SQL estão em `supabase/`:
- `supabase/migrations/0001_core_schema.sql`: 19 tabelas (`transportador`, `motorista`, `veiculo`, `escola`, `aluno`, `responsavel`, `aluno_responsavel`, `usuario_perfil`, `rota`, `parada`, `viagem`, `viagem_parada`, `evento_viagem`, `posicao_veiculo`, `fatura`, `pagamento`, `mensagem_log`, `outbox_evento`, `audit_access_log`).
- `supabase/migrations/0002_rls_policies.sql`: Políticas Row Level Security (RLS) por `transportador_id` e restrições LGPD para motoristas e responsáveis + publicação `supabase_realtime`.
- `supabase/migrations/0003_rpc_functions.sql`: Funções transacionais (`instantiate_trip_stops` e `commit_absence_reoptimization` com `SELECT ... FOR UPDATE`).
- `supabase/seed.sql`: Seed realista com **1 transportador**, **2 vans/motoristas**, **2 escolas**, **20 responsáveis**, **25 alunos**, **3 rotas** (ida e volta), **1 viagem ativa** e **faturas Pix**.

---

## 4. Como Rodar Testes e a Simulação E2E

### Testes Unitários e de Integração (Vitest)
Executa as 5 suítes cobrindo Schema/RLS/LGPD, GPS/ETA, `applyAbsence` (todos os casos de borda e concorrência), Webhook Financeiro Idempotente (`2x`) e Contrato de Tools/WhatsApp:
```bash
npm test
```

### Simulação E2E de Viagem com GPS Fake (`scripts/simulate-trip.ts`)
Simula o fluxo completo exigido nos critérios de aceite:
1. Envia pings GPS fake para a viagem ativa;
2. Registra ausência via `POST /api/tools/registrar-ausencia`;
3. Mede a latência do alerta Realtime ao motorista (validando `< 3s`);
4. Exibe a `novaOrdem` recalculada e o `etaDelta`.

```bash
npm run simulate
```

---

## 5. Rotas da Aplicação e Contrato com o Agente

### Interfaces Web / PWA
- `http://localhost:3000` — Visão Geral da Plataforma
- `http://localhost:3000/login` — Autenticação e Troca de Perfil RLS (`transportador`, `motorista`, `responsavel`)
- `http://localhost:3000/dashboard` — Painel do Transportador com Mapa ao Vivo, Paradas, ETAs e Eventos
- `http://localhost:3000/dashboard/financeiro` — Gestão Financeira Pix (Asaas), Inadimplência e Simulador de Webhook
- `http://localhost:3000/driver` — App do Motorista (PWA Mobile-First, Alto Contraste, Alerta Sonoro + Banner ACK `<3s`, Deep Links Google Maps/Waze)

### Contrato de Tools para o Agente (`Authorization: Bearer <AGENT_SERVICE_TOKEN>`)
- `GET  /api/openapi` — Especificação OpenAPI 3.1 completa
- `POST /api/tools/registrar-ausencia` — Chama `applyAbsence(viagemId, alunoId, origem)`
- `GET  /api/tools/status-viagem?alunoId=` — Posição da van, ETA e parada atual (com auditoria LGPD)
- `GET  /api/tools/fatura?responsavelId=` — Lista faturas abertas do responsável
- `POST /api/tools/gerar-pix` — Emite nova cobrança ou 2ª via Pix atualizada
- `POST /api/tools/notificar-motorista` — Envia alerta prioritário ao canal Realtime do motorista
- `GET  /api/tools/contexto-responsavel?telefone=` — Resolve responsável, alunos vinculados e rotas pelo WhatsApp
