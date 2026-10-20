-- ==============================================================================
-- Migration 0002: Row Level Security (RLS), LGPD Policies & Realtime Channels
-- Isolamento por transportador (tenant) + restrição de visibilidade LGPD
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Funções auxiliares de segurança (Security Definer) para ler contexto do usuário
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_transportador_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT transportador_id
  FROM public.usuario_perfil
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS user_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.usuario_perfil
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_motorista_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT motorista_id
  FROM public.usuario_perfil
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_responsavel_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT responsavel_id
  FROM public.usuario_perfil
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ------------------------------------------------------------------------------
ALTER TABLE transportador ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorista ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE escola ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_responsavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota ENABLE ROW LEVEL SECURITY;
ALTER TABLE parada ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE viagem_parada ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_viagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE posicao_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagem_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Políticas para TRANSPORTADOR (Admin do Tenant: acesso total ao próprio tenant)
-- ------------------------------------------------------------------------------
CREATE POLICY "transportador_tenant_isolation" ON transportador
  FOR ALL USING (id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "usuario_perfil_own_or_tenant" ON usuario_perfil
  FOR SELECT USING (
    user_id = auth.uid()
    OR (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador')
  );

CREATE POLICY "transportador_full_motorista" ON motorista
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_veiculo" ON veiculo
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_escola" ON escola
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_responsavel" ON responsavel
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_aluno" ON aluno
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_aluno_responsavel" ON aluno_responsavel
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_rota" ON rota
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_parada" ON parada
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_viagem" ON viagem
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_viagem_parada" ON viagem_parada
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_evento_viagem" ON evento_viagem
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_posicao_veiculo" ON posicao_veiculo
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_fatura" ON fatura
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_pagamento" ON pagamento
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_mensagem_log" ON mensagem_log
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_full_outbox" ON outbox_evento
  FOR ALL USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

CREATE POLICY "transportador_read_audit_lgpd" ON audit_access_log
  FOR SELECT USING (transportador_id = public.auth_transportador_id() AND public.auth_user_role() = 'transportador');

-- ------------------------------------------------------------------------------
-- 2. Políticas para MOTORISTA (LGPD: acesso estrito às próprias viagens e alunos da viagem)
-- ------------------------------------------------------------------------------
CREATE POLICY "motorista_read_self" ON motorista
  FOR SELECT USING (id = public.auth_motorista_id());

CREATE POLICY "motorista_read_veiculo" ON veiculo
  FOR SELECT USING (
    transportador_id = public.auth_transportador_id()
    AND public.auth_user_role() = 'motorista'
  );

CREATE POLICY "motorista_read_escola" ON escola
  FOR SELECT USING (
    transportador_id = public.auth_transportador_id()
    AND public.auth_user_role() = 'motorista'
  );

CREATE POLICY "motorista_read_own_rota" ON rota
  FOR SELECT USING (
    motorista_id = public.auth_motorista_id()
    AND public.auth_user_role() = 'motorista'
  );

CREATE POLICY "motorista_read_own_parada" ON parada
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rota r
      WHERE r.id = parada.rota_id
        AND r.motorista_id = public.auth_motorista_id()
    )
  );

-- LGPD: Motorista só vê dados de menores (aluno) que estão em rotas/viagens atribuídas a ele
CREATE POLICY "motorista_read_assigned_alunos_lgpd" ON aluno
  FOR SELECT USING (
    public.auth_user_role() = 'motorista'
    AND EXISTS (
      SELECT 1 FROM viagem_parada vp
      JOIN viagem v ON v.id = vp.viagem_id
      WHERE vp.aluno_id = aluno.id
        AND v.motorista_id = public.auth_motorista_id()
    )
  );

CREATE POLICY "motorista_select_update_own_viagem" ON viagem
  FOR SELECT USING (motorista_id = public.auth_motorista_id());

CREATE POLICY "motorista_update_own_viagem" ON viagem
  FOR UPDATE USING (motorista_id = public.auth_motorista_id())
  WITH CHECK (motorista_id = public.auth_motorista_id());

CREATE POLICY "motorista_select_update_viagem_parada" ON viagem_parada
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM viagem v
      WHERE v.id = viagem_parada.viagem_id
        AND v.motorista_id = public.auth_motorista_id()
    )
  );

CREATE POLICY "motorista_insert_select_posicao_veiculo" ON posicao_veiculo
  FOR ALL USING (
    motorista_id = public.auth_motorista_id()
    AND public.auth_user_role() = 'motorista'
  );

CREATE POLICY "motorista_insert_select_evento_viagem" ON evento_viagem
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM viagem v
      WHERE v.id = evento_viagem.viagem_id
        AND v.motorista_id = public.auth_motorista_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 3. Políticas para RESPONSÁVEL (LGPD: vê apenas seus próprios filhos, localização da viagem ativa do filho e suas faturas)
-- ------------------------------------------------------------------------------
CREATE POLICY "responsavel_read_self" ON responsavel
  FOR SELECT USING (id = public.auth_responsavel_id());

CREATE POLICY "responsavel_read_own_links" ON aluno_responsavel
  FOR SELECT USING (responsavel_id = public.auth_responsavel_id());

-- LGPD: Responsável só vê dados dos alunos explicitamente vinculados a ele
CREATE POLICY "responsavel_read_linked_alunos_lgpd" ON aluno
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aluno_responsavel ar
      WHERE ar.aluno_id = aluno.id
        AND ar.responsavel_id = public.auth_responsavel_id()
    )
  );

-- LGPD: Responsável só vê viagens e posição da van se seu filho estiver vinculado à viagem
CREATE POLICY "responsavel_read_linked_viagem_lgpd" ON viagem
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viagem_parada vp
      JOIN aluno_responsavel ar ON ar.aluno_id = vp.aluno_id
      WHERE vp.viagem_id = viagem.id
        AND ar.responsavel_id = public.auth_responsavel_id()
    )
  );

CREATE POLICY "responsavel_read_own_child_viagem_parada_lgpd" ON viagem_parada
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aluno_responsavel ar
      WHERE ar.aluno_id = viagem_parada.aluno_id
        AND ar.responsavel_id = public.auth_responsavel_id()
    )
  );

CREATE POLICY "responsavel_read_active_trip_posicao_lgpd" ON posicao_veiculo
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viagem v
      JOIN viagem_parada vp ON vp.viagem_id = v.id
      JOIN aluno_responsavel ar ON ar.aluno_id = vp.aluno_id
      WHERE v.id = posicao_veiculo.viagem_id
        AND v.status = 'ativa'
        AND ar.responsavel_id = public.auth_responsavel_id()
    )
  );

CREATE POLICY "responsavel_read_own_faturas" ON fatura
  FOR SELECT USING (responsavel_id = public.auth_responsavel_id());

CREATE POLICY "responsavel_read_own_pagamentos" ON pagamento
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fatura f
      WHERE f.id = pagamento.fatura_id
        AND f.responsavel_id = public.auth_responsavel_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Configuração de Canais Supabase Realtime
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE posicao_veiculo;
    ALTER PUBLICATION supabase_realtime ADD TABLE viagem;
    ALTER PUBLICATION supabase_realtime ADD TABLE viagem_parada;
    ALTER PUBLICATION supabase_realtime ADD TABLE evento_viagem;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
