-- ==============================================================================
-- Migration: Create Order Tracking RLS and Functions
-- Timestamp: 20260804032218
-- Description: Enables RLS on all tables, defines customer isolation policies using (SELECT auth.uid()),
--              revokes all privileges from anon/authenticated, grants strict select to authenticated,
--              and creates the atomic claim_customer_account RPC with SET search_path = ''.
-- ==============================================================================

-- 1. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. RLS POLICIES FOR AUTHENTICATED CUSTOMERS

-- Customers: Users can only view their own linked customer record
CREATE POLICY "Authenticated users can view their own customer record"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- Orders: Users can only view orders linked to their customer record
CREATE POLICY "Authenticated users can view their own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = orders.customer_id
        AND c.auth_user_id = (SELECT auth.uid())
    )
  );

-- Order Items: Users can only view items belonging to their own orders
CREATE POLICY "Authenticated users can view items of their own orders"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id
        AND c.auth_user_id = (SELECT auth.uid())
    )
  );

-- Tracking Events: Users can only view tracking events belonging to their own orders
CREATE POLICY "Authenticated users can view tracking of their own orders"
  ON public.tracking_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = tracking_events.order_id
        AND c.auth_user_id = (SELECT auth.uid())
    )
  );

-- Note: email_events and webhook_events intentionally have NO public/authenticated policies.
-- They can only be accessed via service_role / server-side Edge Functions.

-- 3. PERMISSIONS / PRIVILEGES
-- Revoke all table and sequence access from anon, authenticated, and public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, public;

-- Grant selective read-only access to authenticated users (further restricted by RLS)
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.tracking_events TO authenticated;

-- 4. SECURE RPC: claim_customer_account
-- Canonical email verification from auth.users with atomic lock and execution
CREATE OR REPLACE FUNCTION public.claim_customer_account()
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_uid auth.users.id%TYPE;
  v_auth_email auth.users.email%TYPE;
  v_email_confirmed_at auth.users.email_confirmed_at%TYPE;
  v_normalized_email pg_catalog.text;
  v_customer_id public.customers.id%TYPE;
  v_existing_auth_user_id public.customers.auth_user_id%TYPE;
  v_rows_affected pg_catalog.int8;
BEGIN
  -- 1. Ensure user is authenticated
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'status', 'unauthenticated',
      'message', 'User must be authenticated to claim a customer account.'
    );
  END IF;

  -- 2. Extract canonical email and confirmation status directly from auth.users
  SELECT u.email, u.email_confirmed_at
  INTO v_auth_email, v_email_confirmed_at
  FROM auth.users u
  WHERE u.id = v_auth_uid;

  IF v_auth_email IS NULL OR pg_catalog.trim(v_auth_email) = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'status', 'missing_email',
      'message', 'Authenticated user does not have a registered email address.'
    );
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'status', 'unconfirmed_email',
      'message', 'User email must be confirmed before claiming customer account.'
    );
  END IF;

  v_normalized_email := pg_catalog.lower(pg_catalog.trim(v_auth_email));

  -- 3. Lock and fetch customer record by normalized email to prevent race conditions
  SELECT c.id, c.auth_user_id
  INTO v_customer_id, v_existing_auth_user_id
  FROM public.customers c
  WHERE c.email_normalized = v_normalized_email
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'status', 'not_found',
      'message', 'No customer record found matching the authenticated email.'
    );
  END IF;

  -- 4. Verify existing link integrity
  IF v_existing_auth_user_id IS NOT NULL THEN
    IF v_existing_auth_user_id = v_auth_uid THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'status', 'already_claimed',
        'customer_id', v_customer_id,
        'message', 'Customer account is already linked to this user.'
      );
    ELSE
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'status', 'conflict',
        'message', 'Customer account is already linked to a different authentication account.'
      );
    END IF;
  END IF;

  -- 5. Atomic link with concurrency guard
  UPDATE public.customers
  SET auth_user_id = v_auth_uid,
      updated_at = pg_catalog.now()
  WHERE id = v_customer_id
    AND (auth_user_id IS NULL OR auth_user_id = v_auth_uid);

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'status', 'conflict',
      'message', 'Failed to claim customer account due to concurrent modification.'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'claimed',
    'customer_id', v_customer_id,
    'message', 'Customer account successfully linked to authenticated user.'
  );
END;
$$;

-- 5. FUNCTION PERMISSIONS
REVOKE ALL ON FUNCTION public.claim_customer_account() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.claim_customer_account() TO authenticated;
