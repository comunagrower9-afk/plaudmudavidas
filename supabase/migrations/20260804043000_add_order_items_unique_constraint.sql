-- ==============================================================================
-- Migration: Add unique constraint to order_items for idempotent webhook upserts
-- Created At: 2026-08-04
-- ==============================================================================

-- Ensures that order items for a specific order and external product ID can be
-- safely upserted during webhook ingestion without creating duplicate line items.
ALTER TABLE public.order_items
  ADD CONSTRAINT uq_order_items_order_external_product
  UNIQUE (order_id, external_product_id);
