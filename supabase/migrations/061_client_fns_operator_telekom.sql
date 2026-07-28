-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 061 — Alta de FNS Infrastruktur (cliente) y Telekom (operador)
-- Depends on: 001_initial_schema.sql, 004_service_catalog_seed.sql
-- Purpose:
--   Nuevo contratante y nuevo operador de red en las tablas de referencia.
--
--   `clients` es quien contrata el trabajo y a quien se le certifica y factura
--   (hasta hoy: Insyte y Vancom). `operators` es quien explota la red sobre la
--   que se trabaja (DGF, GlasfaserPlus, UGG…). Telekom entra como operador:
--   las órdenes de FNS se ejecutan sobre red de Telekom, igual que las de
--   Insyte se ejecutan sobre red de Deutsche Glasfaser.
--
--   No se crean proyectos aquí: el código de proyecto (HXT, RSD…) lo da el
--   cliente cuando arranca la obra, y se dan de alta desde Administración →
--   Proyectos, que sí tiene UI. Clientes y operadores no la tienen, por eso
--   van por migración.
--
--   Idempotente: `code` es UNIQUE en ambas tablas y se usa ON CONFLICT.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.clients (name, code) VALUES
  ('FNS Infrastruktur GmbH', 'FNS')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.operators (name, code) VALUES
  ('Telekom', 'TELEKOM')
ON CONFLICT (code) DO NOTHING;
