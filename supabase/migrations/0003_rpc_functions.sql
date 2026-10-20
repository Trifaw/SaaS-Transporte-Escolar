-- ==============================================================================
-- Migration 0003: Transactional RPC Functions
-- Garante atomicidade, locks pessimistas e idempotência para applyAbsence e Pix
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Instanciar paradas diárias de uma viagem a partir do template da rota
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.instantiate_trip_stops(p_viagem_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viagem RECORD;
  v_inserted INTEGER := 0;
BEGIN
  SELECT id, transportador_id, rota_id
  INTO v_viagem
  FROM public.viagem
  WHERE id = p_viagem_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VIAGEM_NAO_ENCONTRADA';
  END IF;

  INSERT INTO public.viagem_parada (
    transportador_id,
    viagem_id,
    parada_id,
    aluno_id,
    endereco,
    lat,
    lng,
    ordem_original,
    ordem_atual,
    janela_inicio,
    janela_fim,
    status,
    ack_motorista
  )
  SELECT
    p.transportador_id,
    v_viagem.id,
    p.id,
    p.aluno_id,
    p.endereco,
    p.lat,
    p.lng,
    p.ordem,
    p.ordem,
    p.janela_inicio,
    p.janela_fim,
    'pendente'::status_parada_viagem_enum,
    TRUE
  FROM public.parada p
  WHERE p.rota_id = v_viagem.rota_id
    AND p.ativa = TRUE
  ON CONFLICT (viagem_id, aluno_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Commit atômico e transacional de ausência + nova ordem de paradas (com FOR UPDATE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_absence_reoptimization(
  p_viagem_id UUID,
  p_aluno_id UUID,
  p_origem TEXT,
  p_nova_ordem JSONB, -- Array de objetos: [{ "paradaId": "...", "alunoId": "...", "ordem": 1, "etaPrevisto": "..." }]
  p_eta_delta_segundos INTEGER,
  p_novo_eta_final TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viagem RECORD;
  v_parada RECORD;
  v_item JSONB;
  v_nova_versao INTEGER;
  v_idempotency_key TEXT;
BEGIN
  -- Lock pessimista na linha da viagem para serializar ausências simultâneas
  SELECT * INTO v_viagem
  FROM public.viagem
  WHERE id = p_viagem_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'motivoFalha', 'VIAGEM_NAO_ENCONTRADA');
  END IF;

  IF v_viagem.status <> 'ativa' THEN
    RETURN jsonb_build_object('ok', FALSE, 'motivoFalha', 'VIAGEM_NAO_ATIVA');
  END IF;

  SELECT * INTO v_parada
  FROM public.viagem_parada
  WHERE viagem_id = p_viagem_id
    AND aluno_id = p_aluno_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'motivoFalha', 'PARADA_NAO_ENCONTRADA');
  END IF;

  -- Idempotência: se já estava marcada como ausente, retorna sucesso sem duplicar eventos
  IF v_parada.status = 'ausente' THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'idempotent', TRUE,
      'paradaId', v_parada.parada_id,
      'versaoRota', v_viagem.versao_rota
    );
  END IF;

  -- Valida se a van já passou pela parada
  IF v_parada.status IN ('embarcado', 'desembarcado') THEN
    RETURN jsonb_build_object('ok', FALSE, 'motivoFalha', 'PARADA_JA_CONCLUIDA');
  END IF;

  -- 1. Marca a parada do aluno como ausente e exige ACK do motorista
  UPDATE public.viagem_parada
  SET status = 'ausente',
      origem_ausencia = p_origem,
      ack_motorista = FALSE,
      concluida_em = NOW(),
      updated_at = NOW()
  WHERE id = v_parada.id;

  -- 2. Atualiza a nova ordem e ETAs das paradas restantes pendentes
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_nova_ordem)
  LOOP
    UPDATE public.viagem_parada
    SET eta_anterior = eta_previsto,
        ordem_atual = (v_item->>'ordem')::INTEGER,
        eta_previsto = CASE
          WHEN v_item ? 'etaPrevisto' AND v_item->>'etaPrevisto' IS NOT NULL
          THEN (v_item->>'etaPrevisto')::TIMESTAMPTZ
          ELSE eta_previsto
        END,
        ack_motorista = FALSE,
        updated_at = NOW()
    WHERE viagem_id = p_viagem_id
      AND aluno_id = (v_item->>'alunoId')::UUID
      AND status = 'pendente';
  END LOOP;

  -- 3. Incrementa versão da rota na viagem e atualiza ETA final
  v_nova_versao := v_viagem.versao_rota + 1;
  UPDATE public.viagem
  SET versao_rota = v_nova_versao,
      eta_destino_final = COALESCE(p_novo_eta_final, eta_destino_final),
      updated_at = NOW()
  WHERE id = p_viagem_id;

  -- 4. Registra eventos de viagem (ausencia + rota_alterada)
  INSERT INTO public.evento_viagem (
    transportador_id,
    viagem_id,
    aluno_id,
    parada_id,
    tipo,
    origem,
    payload
  ) VALUES
  (
    v_viagem.transportador_id,
    p_viagem_id,
    p_aluno_id,
    v_parada.parada_id,
    'ausencia',
    p_origem,
    jsonb_build_object('ordemRemovida', v_parada.ordem_atual, 'versaoRota', v_nova_versao)
  ),
  (
    v_viagem.transportador_id,
    p_viagem_id,
    p_aluno_id,
    v_parada.parada_id,
    'rota_alterada',
    p_origem,
    jsonb_build_object(
      'paradaRemovidaAlunoId', p_aluno_id,
      'novaOrdem', p_nova_ordem,
      'etaDelta', p_eta_delta_segundos,
      'versaoRota', v_nova_versao
    )
  );

  -- 5. Publica no Outbox para consumo proativo do AgentGateway (idempotente)
  v_idempotency_key := format('rota_alterada:%s:aluno:%s', p_viagem_id, p_aluno_id);
  INSERT INTO public.outbox_evento (
    transportador_id,
    tipo,
    idempotency_key,
    payload
  ) VALUES (
    v_viagem.transportador_id,
    'rota_alterada',
    v_idempotency_key,
    jsonb_build_object(
      'viagemId', p_viagem_id,
      'alunoAusenteId', p_aluno_id,
      'paradaRemovidaId', v_parada.parada_id,
      'novaOrdem', p_nova_ordem,
      'etaDelta', p_eta_delta_segundos,
      'versaoRota', v_nova_versao
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'idempotent', FALSE,
    'paradaId', v_parada.parada_id,
    'versaoRota', v_nova_versao
  );
END;
$$;
