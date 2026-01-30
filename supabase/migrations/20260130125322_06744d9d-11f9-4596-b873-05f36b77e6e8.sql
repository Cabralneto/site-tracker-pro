-- =====================================================
-- SECURE WORKFLOW PT: RPC + RLS + Column Privileges
-- Resolve:
-- 1) PT Status Updates Lack Workflow State Validation
-- 2) Employee Location Tracking Data Accessible to All Users (eventos)
-- =====================================================

-- -----------------------------------------------------
-- 0) Garantir RLS habilitado
-- -----------------------------------------------------
ALTER TABLE public.pts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 1) RPC segura para transição de status
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_pt_status(
  _pt_id UUID,
  _new_status pt_status,
  _event_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pt RECORD;
  _user_id UUID;
  _now TIMESTAMPTZ := now();
  _tipo_evento tipo_evento;
  _sla RECORD;
  _atraso_etm NUMERIC := 0;
  _atraso_petrobras NUMERIC := 0;
  _impedimento_id UUID;
  _detalhe_impedimento TEXT;
  _observacao TEXT;
  _evento_id UUID;
  _tz TEXT := 'America/Sao_Paulo';
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Lock PT
  SELECT * INTO _pt FROM public.pts WHERE id = _pt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PT não encontrada: %', _pt_id;
  END IF;

  -- Admin bypass
  IF public.is_admin(_user_id) THEN
    NULL;
  ELSE
    -- Validação de transições e papéis
    IF _pt.status = 'pendente' AND _new_status = 'solicitada' THEN
      IF NOT public.has_role(_user_id, 'encarregado') THEN
        RAISE EXCEPTION 'Apenas encarregado pode solicitar PT';
      END IF;
    ELSIF _pt.status = 'solicitada' AND _new_status = 'chegada' THEN
      IF NOT public.has_role(_user_id, 'encarregado') THEN
        RAISE EXCEPTION 'Apenas encarregado pode registrar chegada';
      END IF;
    ELSIF _pt.status = 'chegada' AND _new_status = 'liberada' THEN
      IF NOT public.has_role(_user_id, 'operador') THEN
        RAISE EXCEPTION 'Apenas operador pode liberar PT';
      END IF;
    ELSIF _pt.status = 'chegada' AND _new_status = 'impedida' THEN
      IF NOT public.has_role(_user_id, 'operador') THEN
        RAISE EXCEPTION 'Apenas operador pode registrar impedimento';
      END IF;
    ELSE
      RAISE EXCEPTION 'Transição inválida: % -> %', _pt.status, _new_status;
    END IF;
  END IF;

  -- Map status to event type
  _tipo_evento := CASE _new_status
    WHEN 'solicitada' THEN 'solicitacao'::tipo_evento
    WHEN 'chegada' THEN 'chegada'::tipo_evento
    WHEN 'liberada' THEN 'liberacao'::tipo_evento
    WHEN 'impedida' THEN 'impedimento'::tipo_evento
    ELSE NULL
  END;

  IF _tipo_evento IS NULL THEN
    RAISE EXCEPTION 'Status inválido para evento: %', _new_status;
  END IF;

  -- Extract payload
  _observacao := _event_payload->>'observacao';
  _impedimento_id := NULLIF(_event_payload->>'impedimento_id','')::uuid;
  _detalhe_impedimento := _event_payload->>'detalhe_impedimento';

  IF _new_status = 'impedida' AND _impedimento_id IS NULL THEN
    RAISE EXCEPTION 'Impedimento requer motivo (impedimento_id)';
  END IF;

  -- SLA config (se existir)
  SELECT * INTO _sla FROM public.sla_config WHERE ativo = true LIMIT 1;
  IF _sla IS NOT NULL THEN
    _tz := COALESCE(_sla.timezone, _tz);
  END IF;

  -- Delays
  IF _sla IS NOT NULL AND _new_status = 'solicitada' THEN
    IF (_now AT TIME ZONE _tz)::time > _sla.hora_limite_solicitacao THEN
      _atraso_etm := EXTRACT(EPOCH FROM (
        (_now AT TIME ZONE _tz)::time - _sla.hora_limite_solicitacao
      )) / 60.0;
    END IF;
  ELSIF _sla IS NOT NULL AND _new_status = 'liberada' THEN
    IF (_now AT TIME ZONE _tz)::time > _sla.hora_limite_liberacao THEN
      _atraso_petrobras := EXTRACT(EPOCH FROM (
        (_now AT TIME ZONE _tz)::time - _sla.hora_limite_liberacao
      )) / 60.0;
    END IF;
  END IF;

  -- Insert event (RPC bypass)
  INSERT INTO public.eventos (
    pt_id,
    tipo_evento,
    criado_por,
    criado_em,
    observacao,
    impedimento_id,
    detalhe_impedimento,
    lat,
    lon,
    accuracy,
    user_agent
  ) VALUES (
    _pt_id,
    _tipo_evento,
    _user_id,
    _now,
    _observacao,
    _impedimento_id,
    _detalhe_impedimento,
    NULLIF(_event_payload->>'lat','')::double precision,
    NULLIF(_event_payload->>'lon','')::double precision,
    NULLIF(_event_payload->>'accuracy','')::double precision,
    _event_payload->>'user_agent'
  )
  RETURNING id INTO _evento_id;

  -- Update PT (status e campos críticos só via RPC)
  UPDATE public.pts SET
    status = _new_status,
    atualizado_em = _now,
    atraso_etm = CASE WHEN _atraso_etm > 0 THEN _atraso_etm ELSE atraso_etm END,
    atraso_petrobras = CASE WHEN _atraso_petrobras > 0 THEN _atraso_petrobras ELSE atraso_petrobras END,
    responsavel_atraso = CASE
      WHEN _new_status = 'impedida' THEN 'impedimento'::responsavel_atraso
      WHEN _atraso_etm > 0 THEN 'etm'::responsavel_atraso
      WHEN _atraso_petrobras > 0 THEN 'petrobras'::responsavel_atraso
      ELSE responsavel_atraso
    END,
    causa_atraso = CASE
      WHEN _new_status = 'impedida' THEN COALESCE(_detalhe_impedimento, causa_atraso)
      ELSE causa_atraso
    END
  WHERE id = _pt_id;

  RETURN jsonb_build_object(
    'success', true,
    'pt_id', _pt_id,
    'new_status', _new_status,
    'evento_id', _evento_id,
    'atraso_etm', _atraso_etm,
    'atraso_petrobras', _atraso_petrobras
  );
END;
$$;

-- Permissões da RPC
REVOKE ALL ON FUNCTION public.transition_pt_status(UUID, pt_status, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_pt_status(UUID, pt_status, JSONB) TO authenticated;

-- -----------------------------------------------------
-- 2) PTS: RLS UPDATE simples e bloqueio de colunas críticas
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Controle de Workflow e Ações" ON public.pts;
DROP POLICY IF EXISTS "Authenticated can update allowed fields" ON public.pts;

CREATE POLICY "Authenticated can update allowed fields"
ON public.pts
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) OR
  public.has_role(auth.uid(), 'encarregado') OR
  public.has_role(auth.uid(), 'operador') OR
  criado_por = auth.uid()
)
WITH CHECK (
  public.is_admin(auth.uid()) OR
  public.has_role(auth.uid(), 'encarregado') OR
  public.has_role(auth.uid(), 'operador') OR
  criado_por = auth.uid()
);

-- Column-level privileges: libera update só das colunas não críticas
REVOKE UPDATE ON public.pts FROM authenticated;
GRANT UPDATE (
  numero_pt, tipo_pt, data_servico, efetivo_qtd, equipe,
  encarregado_nome, encarregado_matricula, descricao_operacao,
  frente_id, frente_ids, disciplina_id, disciplina_ids,
  causa_atraso, atualizado_em
) ON public.pts TO authenticated;

-- NÃO liberar: status, atraso_etm, atraso_petrobras, responsavel_atraso
-- Esses só a RPC altera.

-- -----------------------------------------------------
-- 3) EVENTOS: parar exposição e travar escrita pelo client
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Todos podem ver eventos" ON public.eventos;
DROP POLICY IF EXISTS "User can view own eventos" ON public.eventos;
DROP POLICY IF EXISTS "Admin can view all eventos" ON public.eventos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar eventos" ON public.eventos;

-- SELECT: usuário vê apenas eventos criados por ele
CREATE POLICY "User can view own eventos"
ON public.eventos
FOR SELECT
TO authenticated
USING (criado_por = auth.uid());

-- SELECT: admin vê tudo
CREATE POLICY "Admin can view all eventos"
ON public.eventos
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Travar escrita direta em eventos para authenticated
REVOKE INSERT, UPDATE, DELETE ON public.eventos FROM authenticated;