-- ==============================================================================
-- Migration: Create Admin Access and Portal RPCs
-- Timestamp: 20260804070000
-- Description: Phase 1 Admin Authorization and Secure RPCs for Portal/Admin
-- ==============================================================================

-- 1. PRIVATE SCHEMA (Isolated from direct client access)
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2. ADMIN USERS TABLE (Whitelisted auth.users with admin access)
CREATE TABLE public.admin_users (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke all client privileges; access only via service_role and internal SECURITY DEFINER functions
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;

-- 3. ADMIN AUDIT EVENTS TABLE (Immutable append-only operational audit log without PII)
CREATE TABLE public.admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  result_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- Log append-only: service_role recebe exclusivamente SELECT e INSERT (sem UPDATE nem DELETE)
REVOKE ALL ON TABLE public.admin_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_events TO service_role;

CREATE INDEX idx_admin_audit_events_admin_user_id ON public.admin_audit_events(admin_user_id);
CREATE INDEX idx_admin_audit_events_order_id ON public.admin_audit_events(order_id);
CREATE INDEX idx_admin_audit_events_created_at ON public.admin_audit_events(created_at DESC);

-- 4. PRIVATE AUTHORIZATION FUNCTION (Internal SECURITY DEFINER authorization guard)
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.auth_user_id = v_uid
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

REVOKE ALL ON FUNCTION private.current_user_is_admin() FROM PUBLIC, anon, authenticated, service_role;

-- 5. PUBLIC VERIFICATION RPC: current_user_is_admin()
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN private.current_user_is_admin();
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- 6. ADMIN RPC: admin_search_orders(p_query, p_limit, p_offset)
CREATE OR REPLACE FUNCTION public.admin_search_orders(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_query TEXT;
  v_escaped_query TEXT;
  v_limit INTEGER;
  v_offset INTEGER;
  v_total_count BIGINT;
  v_orders JSONB;
BEGIN
  -- 1. Verificação de Autorização
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required' USING ERRCODE = '42501';
  END IF;

  -- 2. Validação e Sanitização dos Parâmetros
  v_clean_query := trim(COALESCE(p_query, ''));
  IF length(v_clean_query) < 2 OR length(v_clean_query) > 100 THEN
    RAISE EXCEPTION 'Invalid query length: search query must be between 2 and 100 characters' USING ERRCODE = '22023';
  END IF;

  v_limit := COALESCE(p_limit, 20);
  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION 'Invalid limit: must be between 1 and 50' USING ERRCODE = '22023';
  END IF;

  v_offset := COALESCE(p_offset, 0);
  IF v_offset < 0 THEN
    RAISE EXCEPTION 'Invalid offset: must be greater than or equal to 0' USING ERRCODE = '22023';
  END IF;

  -- 3. Sanitização de Caracteres Curinga para ILIKE (\, %, _)
  v_escaped_query := replace(replace(replace(v_clean_query, '\', '\\'), '%', '\%'), '_', '\_');

  -- 4. Contagem Total de Resultados Correspondentes com Escape Explícito
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE (
    o.order_number ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
    OR o.vega_order_id ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
    OR c.email_normalized ILIKE '%' || lower(v_escaped_query) || '%' ESCAPE E'\\'
    OR c.full_name ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
  );

  -- 5. Busca Paginada de Pedidos com Escape Explícito (Apenas Campos Mínimos)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'order_id', o.id,
        'order_number', o.order_number,
        'vega_order_id', o.vega_order_id,
        'customer_name', c.full_name,
        'customer_email', c.email,
        'payment_status', o.payment_status,
        'fulfillment_status', o.fulfillment_status,
        'total', o.total,
        'currency', o.currency,
        'tracking_code', o.tracking_code,
        'carrier', o.carrier,
        'created_at', o.created_at
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM (
    SELECT o.id, o.order_number, o.vega_order_id, o.payment_status, o.fulfillment_status, o.total, o.currency, o.tracking_code, o.carrier, o.created_at, o.customer_id
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE (
      o.order_number ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
      OR o.vega_order_id ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
      OR c.email_normalized ILIKE '%' || lower(v_escaped_query) || '%' ESCAPE E'\\'
      OR c.full_name ILIKE '%' || v_escaped_query || '%' ESCAPE E'\\'
    )
    ORDER BY o.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) o
  JOIN public.customers c ON c.id = o.customer_id;

  RETURN jsonb_build_object(
    'orders', v_orders,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_orders(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_search_orders(TEXT, INTEGER, INTEGER) TO authenticated;

-- 7. ADMIN RPC: admin_get_order(p_order_id)
CREATE OR REPLACE FUNCTION public.admin_get_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_tracking_events JSONB;
  v_email_events JSONB;
BEGIN
  -- 1. Verificação de Autorização
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID is required' USING ERRCODE = '22023';
  END IF;

  -- 2. Busca do Pedido e Cliente
  SELECT
    o.id,
    o.order_number,
    o.vega_order_id,
    o.payment_status,
    o.fulfillment_status,
    o.subtotal,
    o.total,
    o.currency,
    o.tracking_code,
    o.tracking_url,
    o.carrier,
    o.shipped_at,
    o.created_at,
    o.updated_at,
    o.shipping_address,
    c.id AS customer_id,
    c.full_name AS customer_name,
    c.email AS customer_email
  INTO v_order
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Order not found'
    );
  END IF;

  -- 3. Itens do Pedido
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'sku', oi.sku,
        'external_product_id', oi.external_product_id
      )
      ORDER BY oi.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  -- 4. Eventos de Rastreamento (sem payloads brutos ou tokens)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', te.id,
        'status', te.status,
        'source', te.source,
        'description', te.description,
        'occurred_at', te.occurred_at
      )
      ORDER BY te.occurred_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_tracking_events
  FROM public.tracking_events te
  WHERE te.order_id = p_order_id;

  -- 5. Resumo dos Eventos de E-mail (sem error_message bruto ou payloads técnicos)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ee.id,
        'template_key', ee.template_key,
        'status', ee.status,
        'attempt_count', ee.attempt_count,
        'sent_at', ee.sent_at,
        'created_at', ee.created_at
      )
      ORDER BY ee.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_email_events
  FROM public.email_events ee
  WHERE ee.order_id = p_order_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'vega_order_id', v_order.vega_order_id,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status,
      'subtotal', v_order.subtotal,
      'total', v_order.total,
      'currency', v_order.currency,
      'tracking_code', v_order.tracking_code,
      'tracking_url', v_order.tracking_url,
      'carrier', v_order.carrier,
      'shipped_at', v_order.shipped_at,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    ),
    'customer', jsonb_build_object(
      'id', v_order.customer_id,
      'full_name', v_order.customer_name,
      'email', v_order.customer_email
    ),
    'shipping_address', COALESCE(v_order.shipping_address, '{}'::jsonb),
    'items', v_items,
    'tracking_events', v_tracking_events,
    'email_events', v_email_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_order(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_order(UUID) TO authenticated;

-- 8. ADMIN WRAPPER RPC: admin_register_order_shipment(...)
CREATE OR REPLACE FUNCTION public.admin_register_order_shipment(
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
  v_admin_uid UUID;
  v_result JSONB;
  v_op_status TEXT;
  v_order_id UUID;
BEGIN
  -- 1. Verificação de Autorização
  v_admin_uid := auth.uid();
  IF v_admin_uid IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required' USING ERRCODE = '42501';
  END IF;

  -- 2. Execução da RPC Canônica de Rastreamento (Sem duplicar regras de negócio)
  v_result := public.register_order_shipment(
    p_order_identifier,
    p_tracking_code,
    p_carrier,
    p_replace_existing
  );

  v_op_status := v_result->>'status';

  -- 3. Registro de Auditoria Administrativa Imutável (Somente status/ação, metadata vazia '{}'::jsonb)
  IF v_op_status IN ('registered', 'replaced') THEN
    v_order_id := (v_result->>'order_id')::UUID;

    INSERT INTO public.admin_audit_events (
      admin_user_id,
      action,
      order_id,
      result_status,
      metadata
    ) VALUES (
      v_admin_uid,
      'order_shipment_' || v_op_status,
      v_order_id,
      v_op_status,
      '{}'::jsonb
    );
  END IF;

  -- 4. Retorno Sanitizado
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_order_shipment(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_register_order_shipment(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
