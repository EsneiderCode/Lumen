-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027 — Add 'scheduler' value to user_role enum
-- Depends on: 026_telegram_event_types.sql
-- Purpose:
--   Introduce the restricted "scheduler" role (Terminplanung) that manages
--   appointments (Termine) for a single line + operator scope.
--
--   This migration ONLY adds the enum value. Postgres cannot add an enum value
--   and reference it in the same transaction, so the table + RLS that reference
--   'scheduler' live in migration 028.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'scheduler';
