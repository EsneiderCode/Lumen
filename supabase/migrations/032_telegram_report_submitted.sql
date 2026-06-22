-- Depends on: 026_telegram_event_types.sql
-- Add report_submitted event type for notifications when a technician submits a Rückmeldung

ALTER TYPE public.telegram_event_type ADD VALUE IF NOT EXISTS 'report_submitted';
