-- ==============================================================================
-- Supabase Local Seed File
-- Environment: LOCAL DEVELOPMENT ONLY
-- Note: Contains only fictitious test data. Do NOT use in production.
-- ==============================================================================

-- 1. Fictitious unlinked customer (simulating an order created via webhook before user login)
INSERT INTO public.customers (
  id,
  auth_user_id,
  email,
  full_name,
  phone,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL, -- Unlinked initially, to test claim_customer_account
  'cliente.teste@example.com',
  'Comprador de Teste Fictício',
  '+5511999990000',
  now(),
  now()
) ON CONFLICT (email_normalized) DO NOTHING;

-- 2. Fictitious order for this customer
INSERT INTO public.orders (
  id,
  vega_order_id,
  order_number,
  customer_id,
  payment_status,
  fulfillment_status,
  currency,
  subtotal,
  total,
  shipping_address,
  tracking_code,
  carrier,
  tracking_url,
  estimated_delivery_start,
  estimated_delivery_end,
  paid_at,
  metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  'VEGA-TEST-ORDER-1001',
  '#PLD-1001',
  '00000000-0000-0000-0000-000000000001',
  'paid',
  'processing',
  'BRL',
  119.90,
  119.90,
  '{"logradouro": "Av. Paulista", "numero": "1000", "bairro": "Bela Vista", "cidade": "São Paulo", "uf": "SP", "cep": "01310-100"}'::jsonb,
  'PLD123456789BR',
  'Correios',
  'https://rastreamento.correios.com.br/app/index.php?codigo=PLD123456789BR',
  CURRENT_DATE + INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '10 days',
  now(),
  '{"color": "Preto Matte", "source": "local_seed"}'::jsonb,
  now(),
  now()
) ON CONFLICT (vega_order_id) DO NOTHING;

-- 3. Fictitious item for this order
INSERT INTO public.order_items (
  id,
  order_id,
  external_product_id,
  sku,
  product_name,
  quantity,
  unit_price,
  image_url,
  metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000010',
  'PROD-PLAUD-NOTE',
  'PLAUD-NOTE-BLK',
  'PLAUD NOTE AI Voice Recorder - Preto Matte',
  1,
  119.90,
  '/images/product-black.png',
  '{"storage": "64GB"}'::jsonb,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
