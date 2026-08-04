-- ==============================================================================
-- Migration: Create register_order_shipment RPC
-- Created At: 2026-08-04
-- Description: Atomic and idempotent RPC for registering shipment tracking data
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.register_order_shipment(
  p_order_identifier TEXT,
  p_tracking_code TEXT,
  p_carrier TEXT DEFAULT NULL,
  p_replace_existing BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_order_identifier TEXT;
  v_clean_tracking_code TEXT;
  v_clean_carrier TEXT;
  v_canonical_tracking_url TEXT;
  v_replace_existing BOOLEAN;
  v_new_fulfillment_status public.orders.fulfillment_status%TYPE;
  v_order RECORD;
  v_email_event_id UUID;
  v_tracking_external_id TEXT;
  v_email_idempotency_key TEXT;
  v_op_status TEXT;
BEGIN
  -- 1. Normalização e Validação de Entrada
  v_replace_existing := COALESCE(p_replace_existing, false);
  v_clean_order_identifier := trim(p_order_identifier);
  IF v_clean_order_identifier IS NULL OR v_clean_order_identifier = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid_input',
      'message', 'Order identifier is required'
    );
  END IF;

  v_clean_tracking_code := upper(trim(p_tracking_code));
  -- Regex estrita: 6 a 50 caracteres alfanuméricos sem espaços ou caracteres especiais
  IF v_clean_tracking_code IS NULL OR NOT (v_clean_tracking_code ~ '^[A-Z0-9]{6,50}$') THEN
    RETURN jsonb_build_object(
      'status', 'invalid_input',
      'message', 'Invalid tracking code format (must be 6-50 alphanumeric characters without spaces or special symbols)'
    );
  END IF;

  v_clean_carrier := NULLIF(trim(p_carrier), '');
  IF v_clean_carrier IS NOT NULL AND length(v_clean_carrier) > 100 THEN
    RETURN jsonb_build_object(
      'status', 'invalid_input',
      'message', 'Carrier name must not exceed 100 characters'
    );
  END IF;

  -- 2. Localização do Pedido com Lock Atômico FOR UPDATE
  SELECT
    o.id,
    o.order_number,
    o.vega_order_id,
    o.customer_id,
    o.payment_status,
    o.fulfillment_status,
    o.tracking_code,
    o.tracking_url,
    o.carrier,
    o.shipped_at,
    o.metadata,
    c.email AS customer_email
  INTO v_order
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE (o.order_number = v_clean_order_identifier OR o.vega_order_id = v_clean_order_identifier)
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Order not found'
    );
  END IF;

  -- 3. Verificação de Regras de Negócio e Estados
  IF v_order.payment_status != 'paid' THEN
    RETURN jsonb_build_object(
      'status', 'not_paid',
      'message', 'Order cannot be shipped because payment status is not paid'
    );
  END IF;

  -- Bloqueio estrito para estados terminais ou cancelados
  IF v_order.fulfillment_status IN ('delivered', 'returned', 'cancelled') THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'message', 'Cannot register shipment for ' || v_order.fulfillment_status || ' order'
    );
  END IF;

  -- Cálculo de não-regressão de fulfillment_status:
  -- Se já estiver em 'in_transit', 'out_for_delivery' ou 'exception', preserva o status atual.
  -- Se estiver em 'unfulfilled', 'processing' ou 'shipped', define/mantém 'shipped'.
  IF v_order.fulfillment_status IN ('in_transit', 'out_for_delivery', 'exception') THEN
    v_new_fulfillment_status := v_order.fulfillment_status;
  ELSE
    v_new_fulfillment_status := 'shipped';
  END IF;

  -- 4. Construção da URL Canônica da 17TRACK
  v_canonical_tracking_url := 'https://www.17track.net/pt?nums=' || v_clean_tracking_code;
  v_email_idempotency_key := 'order-shipped:' || v_order.id || ':' || v_clean_tracking_code;
  v_tracking_external_id := 'manual:shipped:' || v_clean_tracking_code;

  -- 5. Tratamento de Idempotência e Conflito de Rastreamento
  -- Caso A: Mesmo pedido e mesmo código de rastreamento já cadastrados
  IF v_order.tracking_code = v_clean_tracking_code THEN
    -- Garante que o email_event existe para permitir retry se necessário
    SELECT id INTO v_email_event_id
    FROM public.email_events
    WHERE idempotency_key = v_email_idempotency_key;

    IF v_email_event_id IS NULL THEN
      INSERT INTO public.email_events (
        order_id,
        recipient,
        template_key,
        idempotency_key,
        status,
        attempt_count,
        next_attempt_at,
        metadata
      ) VALUES (
        v_order.id,
        v_order.customer_email,
        'order_shipped',
        v_email_idempotency_key,
        'queued',
        0,
        now(),
        jsonb_build_object('tracking_code', v_clean_tracking_code)
      )
      ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_email_event_id;
    END IF;

    RETURN jsonb_build_object(
      'status', 'already_registered',
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'tracking_code', v_clean_tracking_code,
      'tracking_url', v_canonical_tracking_url,
      'carrier', v_order.carrier,
      'email_event_id', v_email_event_id
    );
  END IF;

  -- Caso B: Pedido já possui código diferente e replace_existing = false
  IF v_order.tracking_code IS NOT NULL AND v_order.tracking_code != v_clean_tracking_code AND NOT v_replace_existing THEN
    RETURN jsonb_build_object(
      'status', 'tracking_conflict',
      'message', 'Order already has a different tracking code registered. Set replace_existing to true to override.',
      'existing_tracking_code', v_order.tracking_code
    );
  END IF;

  -- Determina status da operação: 'replaced' se já tinha código anterior, 'registered' se for o primeiro
  IF v_order.tracking_code IS NOT NULL THEN
    v_op_status := 'replaced';
  ELSE
    v_op_status := 'registered';
  END IF;

  -- 6. Atualização Atômica do Pedido (sem regressão de status e preservando shipped_at)
  UPDATE public.orders
  SET
    tracking_code = v_clean_tracking_code,
    tracking_url = v_canonical_tracking_url,
    carrier = COALESCE(v_clean_carrier, v_order.carrier),
    fulfillment_status = v_new_fulfillment_status,
    shipped_at = COALESCE(v_order.shipped_at, now()),
    metadata = COALESCE(v_order.metadata, '{}'::jsonb) || jsonb_build_object('tracking_provider', '17track'),
    updated_at = now()
  WHERE id = v_order.id;

  -- 7. Registro do Evento de Rastreamento (Idempotente)
  INSERT INTO public.tracking_events (
    order_id,
    status,
    source,
    description,
    occurred_at,
    external_event_id,
    payload
  ) VALUES (
    v_order.id,
    v_new_fulfillment_status,
    'manual_admin',
    'Pedido enviado e código de rastreamento cadastrado',
    now(),
    v_tracking_external_id,
    jsonb_build_object(
      'tracking_provider', '17track',
      'carrier_provided', (v_clean_carrier IS NOT NULL)
    )
  )
  ON CONFLICT (order_id, external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING;

  -- 8. Registro do Evento de E-mail (Outbox Durável Idempotente)
  INSERT INTO public.email_events (
    order_id,
    recipient,
    template_key,
    idempotency_key,
    status,
    attempt_count,
    next_attempt_at,
    metadata
  ) VALUES (
    v_order.id,
    v_order.customer_email,
    'order_shipped',
    v_email_idempotency_key,
    'queued',
    0,
    now(),
    jsonb_build_object('tracking_code', v_clean_tracking_code)
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = now()
    WHERE public.email_events.status IN ('queued', 'failed')
  RETURNING id INTO v_email_event_id;

  -- Se o email_event já estava como 'sent' ou 'delivered', não foi atualizado pela cláusula WHERE
  IF v_email_event_id IS NULL THEN
    SELECT id INTO v_email_event_id
    FROM public.email_events
    WHERE idempotency_key = v_email_idempotency_key;
  END IF;

  -- 9. Retorno com dados da operação
  RETURN jsonb_build_object(
    'status', v_op_status,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'tracking_code', v_clean_tracking_code,
    'tracking_url', v_canonical_tracking_url,
    'carrier', COALESCE(v_clean_carrier, v_order.carrier),
    'email_event_id', v_email_event_id
  );
END;
$$;

-- Revoga permissões de papéis não autorizados
REVOKE EXECUTE ON FUNCTION public.register_order_shipment(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Concede permissão de execução exclusivamente para service_role
GRANT EXECUTE ON FUNCTION public.register_order_shipment(TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
