-- ==============================================================================
-- Migration: Create Order Tracking Schema
-- Timestamp: 20260804032158
-- Description: Creates enums, tables, constraints, updated_at triggers, and indexes
-- ==============================================================================

-- 1. ENUMS
CREATE TYPE public.payment_status_enum AS ENUM (
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'chargeback'
);

CREATE TYPE public.fulfillment_status_enum AS ENUM (
  'unfulfilled',
  'processing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'returned',
  'cancelled'
);

CREATE TYPE public.email_status_enum AS ENUM (
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed'
);

CREATE TYPE public.webhook_status_enum AS ENUM (
  'received',
  'processed',
  'failed',
  'ignored'
);

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. CUSTOMERS TABLE
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(trim(email))) STORED NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vega_order_id TEXT NOT NULL UNIQUE,
  order_number TEXT UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  payment_status public.payment_status_enum NOT NULL DEFAULT 'pending',
  fulfillment_status public.fulfillment_status_enum NOT NULL DEFAULT 'unfulfilled',
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  shipping_address JSONB,
  tracking_code TEXT,
  carrier TEXT,
  tracking_url TEXT,
  estimated_delivery_start DATE,
  estimated_delivery_end DATE,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_estimated_delivery_range CHECK (
    estimated_delivery_start IS NULL OR
    estimated_delivery_end IS NULL OR
    estimated_delivery_end >= estimated_delivery_start
  )
);

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. ORDER ITEMS TABLE
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  external_product_id TEXT,
  sku TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. TRACKING EVENTS TABLE
CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  external_event_id TEXT,
  status public.fulfillment_status_enum NOT NULL,
  description TEXT,
  location TEXT,
  source TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index to prevent duplicate external events per order
CREATE UNIQUE INDEX uq_tracking_events_order_external_id
  ON public.tracking_events (order_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

-- 7. EMAIL EVENTS TABLE
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  template_key TEXT NOT NULL,
  provider_message_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status public.email_status_enum NOT NULL DEFAULT 'queued',
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_email_events_updated_at
  BEFORE UPDATE ON public.email_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8. WEBHOOK EVENTS TABLE
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_event_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN,
  status public.webhook_status_enum NOT NULL DEFAULT 'received',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index to prevent duplicate external events per provider
CREATE UNIQUE INDEX uq_webhook_events_provider_external_id
  ON public.webhook_events (provider, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE TRIGGER set_webhook_events_updated_at
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9. PERFORMANCE INDEXES
-- Note: customers(auth_user_id) already has an implicit unique index
CREATE INDEX idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX idx_orders_fulfillment_status ON public.orders (fulfillment_status);
CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_tracking_events_order_id ON public.tracking_events (order_id);
CREATE INDEX idx_tracking_events_occurred_at ON public.tracking_events (occurred_at DESC);
CREATE INDEX idx_email_events_order_id ON public.email_events (order_id);
CREATE INDEX idx_email_events_status ON public.email_events (status);
CREATE INDEX idx_webhook_events_provider ON public.webhook_events (provider);
CREATE INDEX idx_webhook_events_status ON public.webhook_events (status);
