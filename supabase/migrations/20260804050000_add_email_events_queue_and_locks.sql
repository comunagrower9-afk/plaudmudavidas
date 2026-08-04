-- ==============================================================================
-- Migration: Add lock and retry scheduling columns to email_events
-- Created At: 2026-08-04
-- ==============================================================================

-- Adds concurrency control and retry scheduling columns to support the durable outbox pattern
ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_token UUID;

-- Partial index to optimize concurrent worker polling and locking for eligible emails
CREATE INDEX IF NOT EXISTS idx_email_events_queue_poll
  ON public.email_events (status, next_attempt_at, locked_at)
  WHERE status IN ('queued', 'failed');
