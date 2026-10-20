-- ==============================================================================
-- Migration 0001: Core Schema — SaaS de Transporte Escolar (MVP)
-- Inclui todas as entidades do domínio, índices, constraints, outbox e LGPD log
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- Enums de Domínio
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('transportador', 'motorista', 'responsavel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE turno_rota_enum AS ENUM ('ida', 'volta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_viagem_enum AS ENUM ('agendada', 'ativa', 'concluida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_parada_viagem_enum AS ENUM ('pendente', 'embarcado', 'desembarcado', 'ausente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_evento_viagem_enum AS ENUM (
    'ausencia',
    'embarque',
    'desembarque',
    'atraso',
    'van_chegando',
    'rota_alterada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_fatura_enum AS ENUM ('pendente', 'paga', 'vencida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE direcao_mensagem_enum AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_entrega_mensagem_enum AS ENUM (
    'received',
    'queued',
    'sent',
    'delivered',
    'read',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_outbox_evento_enum AS ENUM (
    'van_chegando',
    'atraso',
    'rota_alterada',
    'fatura_vencendo',
    'pagamento_confirmado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_outbox_enum AS ENUM ('pending', 'processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 1. Transportador (Tenant)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transportador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj_cpf TEXT NOT NULL UNIQUE,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL,
  -- Parâmetros operacionais e financeiros configuráveis por transportador
  config_van_chegando_minutos INTEGER NOT NULL DEFAULT 5 CHECK (config_van_chegando_minutos >= 1 AND config_van_chegando_minutos <= 30),
  config_atraso_minutos INTEGER NOT NULL DEFAULT 10 CHECK (config_atraso_minutos >= 1 AND config_atraso_minutos <= 120),
  config_multa_percentual NUMERIC(5,2) NOT NULL DEFAULT 2.00 CHECK (config_multa_percentual >= 0),
  config_juros_mensal_percentual NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (config_juros_mensal_percentual >= 0),
  config_dia_vencimento_padrao INTEGER NOT NULL DEFAULT 10 CHECK (config_dia_vencimento_padrao BETWEEN 1 AND 28),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Motorista
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motorista (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  user_id UUID UNIQUE, -- Referência opcional para auth.users(id)
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  cnh TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transportador_id, cpf)
);

-- ------------------------------------------------------------------------------
-- 3. Veículo (Van)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  motorista_padrao_id UUID REFERENCES motorista(id) ON DELETE SET NULL,
  apelido TEXT NOT NULL, -- Ex: "Van 01 - Tio Carlos"
  placa TEXT NOT NULL,
  modelo TEXT NOT NULL,
  capacidade INTEGER NOT NULL CHECK (capacidade > 0),
  ano INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transportador_id, placa)
);

-- ------------------------------------------------------------------------------
-- 4. Escola
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  telefone TEXT,
  contato_portaria TEXT,
  horario_entrada_manha TIME,
  horario_saida_manha TIME,
  horario_entrada_tarde TIME,
  horario_saida_tarde TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Responsável (com Telefone WhatsApp normalizado E.164)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responsavel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  user_id UUID UNIQUE, -- Referência opcional para auth.users(id)
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  telefone_whatsapp TEXT NOT NULL, -- Formato E.164 ex: +5511999990001
  email TEXT,
  endereco TEXT,
  asaas_customer_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transportador_id, telefone_whatsapp),
  UNIQUE (transportador_id, cpf)
);

-- ------------------------------------------------------------------------------
-- 6. Aluno (Menor — Protegido por LGPD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aluno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  escola_id UUID NOT NULL REFERENCES escola(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  serie_turma TEXT NOT NULL,
  endereco_residencial TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  valor_mensalidade NUMERIC(10,2) NOT NULL CHECK (valor_mensalidade >= 0),
  dia_vencimento INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  observacoes_medicas TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. Vínculo Aluno-Responsável
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aluno_responsavel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES responsavel(id) ON DELETE CASCADE,
  parentesco TEXT NOT NULL DEFAULT 'Mae/Pai',
  responsavel_financeiro BOOLEAN NOT NULL DEFAULT TRUE,
  pode_registrar_ausencia BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (aluno_id, responsavel_id)
);

-- ------------------------------------------------------------------------------
-- 8. Perfil de Usuário (Mapeamento Auth -> Tenant & Role para RLS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE, -- Vinculado a auth.users(id)
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  role user_role_enum NOT NULL,
  motorista_id UUID REFERENCES motorista(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES responsavel(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. Rota (Template com Turno: ida / volta)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  escola_id UUID NOT NULL REFERENCES escola(id) ON DELETE RESTRICT,
  veiculo_id UUID NOT NULL REFERENCES veiculo(id) ON DELETE RESTRICT,
  motorista_id UUID NOT NULL REFERENCES motorista(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  turno turno_rota_enum NOT NULL,
  ponto_partida_nome TEXT NOT NULL,
  ponto_partida_lat DOUBLE PRECISION NOT NULL CHECK (ponto_partida_lat BETWEEN -90 AND 90),
  ponto_partida_lng DOUBLE PRECISION NOT NULL CHECK (ponto_partida_lng BETWEEN -180 AND 180),
  horario_inicio_previsto TIME NOT NULL,
  horario_chegada_escola_previsto TIME NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. Parada (Template fixo da Rota: aluno, endereço, ordem, janela de horário)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rota(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  ordem INTEGER NOT NULL CHECK (ordem >= 1),
  janela_inicio TIME NOT NULL,
  janela_fim TIME NOT NULL,
  duracao_parada_segundos INTEGER NOT NULL DEFAULT 60 CHECK (duracao_parada_segundos >= 0),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rota_id, aluno_id),
  CHECK (janela_fim >= janela_inicio)
);

-- ------------------------------------------------------------------------------
-- 11. Viagem (Instância Diária da Rota)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rota(id) ON DELETE RESTRICT,
  motorista_id UUID NOT NULL REFERENCES motorista(id) ON DELETE RESTRICT,
  veiculo_id UUID NOT NULL REFERENCES veiculo(id) ON DELETE RESTRICT,
  data_viagem DATE NOT NULL DEFAULT CURRENT_DATE,
  turno turno_rota_enum NOT NULL,
  status status_viagem_enum NOT NULL DEFAULT 'agendada',
  iniciada_em TIMESTAMPTZ,
  encerrada_em TIMESTAMPTZ,
  ultima_lat DOUBLE PRECISION,
  ultima_lng DOUBLE PRECISION,
  ultima_velocidade_kmh DOUBLE PRECISION,
  ultima_atualizacao_gps TIMESTAMPTZ,
  eta_destino_final TIMESTAMPTZ,
  versao_rota INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rota_id, data_viagem)
);

-- ------------------------------------------------------------------------------
-- 12. Viagem Parada (Estado Diário de Cada Parada na Viagem)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viagem_parada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  viagem_id UUID NOT NULL REFERENCES viagem(id) ON DELETE CASCADE,
  parada_id UUID NOT NULL REFERENCES parada(id) ON DELETE RESTRICT,
  aluno_id UUID NOT NULL REFERENCES aluno(id) ON DELETE RESTRICT,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  ordem_original INTEGER NOT NULL CHECK (ordem_original >= 1),
  ordem_atual INTEGER NOT NULL CHECK (ordem_atual >= 1),
  janela_inicio TIME NOT NULL,
  janela_fim TIME NOT NULL,
  status status_parada_viagem_enum NOT NULL DEFAULT 'pendente',
  eta_previsto TIMESTAMPTZ,
  eta_anterior TIMESTAMPTZ,
  distancia_restante_metros DOUBLE PRECISION,
  concluida_em TIMESTAMPTZ,
  origem_ausencia TEXT,
  ack_motorista BOOLEAN NOT NULL DEFAULT TRUE,
  ack_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viagem_id, aluno_id)
);

-- ------------------------------------------------------------------------------
-- 13. Evento Viagem (ausência, embarque, desembarque, atraso, van_chegando, rota_alterada)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_viagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  viagem_id UUID NOT NULL REFERENCES viagem(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES aluno(id) ON DELETE SET NULL,
  parada_id UUID REFERENCES parada(id) ON DELETE SET NULL,
  tipo tipo_evento_viagem_enum NOT NULL,
  origem TEXT NOT NULL DEFAULT 'sistema', -- Ex: 'whatsapp', 'app_motorista', 'painel', 'gps_monitor'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. Posição Veículo (Telemetria GPS + Canal Realtime)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posicao_veiculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  viagem_id UUID NOT NULL REFERENCES viagem(id) ON DELETE CASCADE,
  veiculo_id UUID NOT NULL REFERENCES veiculo(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL REFERENCES motorista(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  velocidade_kmh DOUBLE PRECISION DEFAULT 0,
  direcao_graus DOUBLE PRECISION DEFAULT 0,
  precisao_metros DOUBLE PRECISION DEFAULT 10,
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. Fatura (Mensalidade por Aluno/Responsável)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES responsavel(id) ON DELETE RESTRICT,
  aluno_id UUID NOT NULL REFERENCES aluno(id) ON DELETE RESTRICT,
  competencia TEXT NOT NULL, -- Formato YYYY-MM (ex: '2026-10')
  valor_original NUMERIC(10,2) NOT NULL CHECK (valor_original >= 0),
  multa_aplicada NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (multa_aplicada >= 0),
  juros_aplicado NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (juros_aplicado >= 0),
  valor_total NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0),
  data_vencimento DATE NOT NULL,
  status status_fatura_enum NOT NULL DEFAULT 'pendente',
  external_charge_id TEXT UNIQUE, -- ID da cobrança no Asaas
  pix_txid TEXT,
  pix_qr_code_base64 TEXT,
  pix_copia_e_cola TEXT,
  pix_expiracao TIMESTAMPTZ,
  ultima_cobranca_enviada_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transportador_id, aluno_id, competencia)
);

-- ------------------------------------------------------------------------------
-- 16. Pagamento (Baixas Idempotentes via Webhook)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  fatura_id UUID NOT NULL REFERENCES fatura(id) ON DELETE RESTRICT,
  external_payment_id TEXT NOT NULL, -- ID do pagamento no Asaas
  external_event_id TEXT NOT NULL,   -- ID único do evento de webhook para idempotência
  valor_pago NUMERIC(10,2) NOT NULL CHECK (valor_pago >= 0),
  metodo TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'confirmado',
  payload_webhook JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_event_id),
  UNIQUE (fatura_id, external_payment_id)
);

-- ------------------------------------------------------------------------------
-- 17. Mensagem Log (Histórico WhatsApp Inbound / Outbound)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagem_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID REFERENCES transportador(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES responsavel(id) ON DELETE SET NULL,
  direcao direcao_mensagem_enum NOT NULL,
  telefone TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'text',
  template_name TEXT,
  conteudo TEXT NOT NULL,
  external_message_id TEXT UNIQUE,
  status_entrega status_entrega_mensagem_enum NOT NULL DEFAULT 'received',
  tentativas INTEGER NOT NULL DEFAULT 1,
  erro_detalhe TEXT,
  gateway_response JSONB,
  payload_bruto JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. Outbox de Eventos Proativos (Consumível pelo AgentGateway)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox_evento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID NOT NULL REFERENCES transportador(id) ON DELETE CASCADE,
  tipo tipo_outbox_evento_enum NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  status status_outbox_enum NOT NULL DEFAULT 'pending',
  tentativas INTEGER NOT NULL DEFAULT 0,
  proximo_retry_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  erro_detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 19. Auditoria de Acesso LGPD (Dados de Menores e Localização)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportador_id UUID REFERENCES transportador(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL, -- 'transportador', 'motorista', 'responsavel', 'agent_service_token'
  aluno_id UUID REFERENCES aluno(id) ON DELETE SET NULL,
  recurso TEXT NOT NULL,    -- Ex: 'status-viagem', 'contexto-responsavel', 'mapa-ao-vivo'
  acao TEXT NOT NULL,       -- Ex: 'READ_LOCATION', 'WRITE_ABSENCE', 'READ_MINOR_PROFILE'
  origem_ip TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Índices para Performance de Consultas Críticas
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_motorista_transportador ON motorista(transportador_id);
CREATE INDEX IF NOT EXISTS idx_veiculo_transportador ON veiculo(transportador_id);
CREATE INDEX IF NOT EXISTS idx_aluno_transportador_escola ON aluno(transportador_id, escola_id);
CREATE INDEX IF NOT EXISTS idx_responsavel_telefone ON responsavel(telefone_whatsapp);
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_resp ON aluno_responsavel(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_parada_rota_ordem ON parada(rota_id, ordem);
CREATE INDEX IF NOT EXISTS idx_viagem_transportador_status ON viagem(transportador_id, status, data_viagem);
CREATE INDEX IF NOT EXISTS idx_viagem_parada_viagem_ordem ON viagem_parada(viagem_id, ordem_atual);
CREATE INDEX IF NOT EXISTS idx_viagem_parada_aluno ON viagem_parada(aluno_id, status);
CREATE INDEX IF NOT EXISTS idx_evento_viagem_viagem ON evento_viagem(viagem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posicao_veiculo_viagem_time ON posicao_veiculo(viagem_id, capturado_em DESC);
CREATE INDEX IF NOT EXISTS idx_fatura_responsavel_status ON fatura(responsavel_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fatura_transportador_status ON fatura(transportador_id, status, competencia);
CREATE INDEX IF NOT EXISTS idx_mensagem_log_telefone ON mensagem_log(telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_evento(status, proximo_retry_em) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_audit_lgpd_aluno ON audit_access_log(aluno_id, created_at DESC);
