-- Depends on: 017_telegram_groups_config.sql
-- Add order_cancelled and order_deleted to telegram_event_type enum

ALTER TYPE public.telegram_event_type ADD VALUE IF NOT EXISTS 'order_cancelled';
ALTER TYPE public.telegram_event_type ADD VALUE IF NOT EXISTS 'order_deleted';
