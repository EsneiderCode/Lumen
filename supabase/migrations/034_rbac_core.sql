-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 034 — Dynamic RBAC core (roles, permissions, assignments)
-- Depends on: 033_subcontractor_onboarding.sql
-- Purpose:
--   Introduce a dynamic role/permission model so authorization is no longer
--   hardcoded to the profiles.role enum:
--     - roles                : admin-manageable role definitions (infinite custom roles)
--     - permissions          : catalog of module.action capability keys
--     - role_permissions     : which permissions each role grants
--     - user_roles           : which roles each user holds (M:N)
--     - user_permissions     : direct per-user permission grants (additive only)
--   Helper functions:
--     - user_has_permission(uid, perm) / has_permission(perm) : RLS + Edge checks
--     - get_my_permissions()                                  : frontend bootstrap
--     - sync_permissions(jsonb)                               : auto-register new
--       permissions from the app's module registry; auto-grants them to roles
--       flagged auto_grant_new.
--   The 4 existing enum roles are seeded as non-deletable system roles and every
--   profile is backfilled into user_roles, so behavior is identical on day 1.
--   profiles.role is KEPT as the base persona (PIN login, contractor business
--   rules, ownership RLS) and stays in sync via trigger.
--
-- ⚠ This migration only ADDS the RBAC layer. Existing role-literal policies are
--   rewritten to permission checks in 035_rbac_policy_migration.sql.
--
-- Run manually in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,
  description    TEXT,
  is_system      BOOLEAN NOT NULL DEFAULT false,
  auto_grant_new BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module      TEXT NOT NULL,
  action      TEXT NOT NULL,
  description TEXT,
  key         TEXT GENERATED ALWAYS AS (module || '.' || action) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id        ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id  ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id  ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_key           ON public.permissions(key);

DROP TRIGGER IF EXISTS roles_updated_at ON public.roles;
CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) Helper functions ─────────────────────────────────────────────────────────

-- Effective permission check for an explicit user. Inactive profiles and
-- inactive roles never grant anything. SECURITY DEFINER so RLS on the RBAC
-- tables themselves cannot recurse into this check.
CREATE OR REPLACE FUNCTION public.user_has_permission(uid UUID, perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pf
    WHERE pf.id = uid
      AND COALESCE(pf.is_active, true)
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r            ON r.id = ur.role_id AND r.is_active
          JOIN public.role_permissions rp ON rp.role_id = ur.role_id
          JOIN public.permissions p       ON p.id = rp.permission_id
          WHERE ur.user_id = uid AND p.key = perm
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_permissions up
          JOIN public.permissions p ON p.id = up.permission_id
          WHERE up.user_id = uid AND p.key = perm
        )
      )
  );
$$;

-- Convenience wrapper for RLS policies: checks the current user.
CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.user_has_permission(auth.uid(), perm);
$$;

-- All effective permission keys for the current user (frontend bootstrap;
-- called once per session after login).
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT p.key
  FROM public.profiles pf
  JOIN public.user_roles ur       ON ur.user_id = pf.id
  JOIN public.roles r             ON r.id = ur.role_id AND r.is_active
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p       ON p.id = rp.permission_id
  WHERE pf.id = auth.uid() AND COALESCE(pf.is_active, true)
  UNION
  SELECT DISTINCT p.key
  FROM public.profiles pf
  JOIN public.user_permissions up ON up.user_id = pf.id
  JOIN public.permissions p       ON p.id = up.permission_id
  WHERE pf.id = auth.uid() AND COALESCE(pf.is_active, true);
$$;

-- Auto-registration of new permissions from the app's module registry.
-- Input: '[{"module":"reports","action":"view","description":"..."}, ...]'
-- Creates missing (module, action) rows and grants the NEW ones to every
-- active role flagged auto_grant_new. Returns the created keys.
CREATE OR REPLACE FUNCTION public.sync_permissions(perms JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  created_keys TEXT[];
BEGIN
  IF NOT public.has_permission('roles.edit') THEN
    RAISE EXCEPTION 'sync_permissions requires roles.edit permission';
  END IF;

  WITH incoming AS (
    SELECT DISTINCT
      x.module,
      x.action,
      x.description
    FROM jsonb_to_recordset(perms) AS x(module TEXT, action TEXT, description TEXT)
    WHERE x.module IS NOT NULL AND x.action IS NOT NULL
  ),
  inserted AS (
    INSERT INTO public.permissions (module, action, description)
    SELECT i.module, i.action, i.description
    FROM incoming i
    ON CONFLICT (module, action) DO NOTHING
    RETURNING id, key
  ),
  granted AS (
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT r.id, ins.id
    FROM inserted ins
    CROSS JOIN public.roles r
    WHERE r.auto_grant_new AND r.is_active
    ON CONFLICT DO NOTHING
    RETURNING role_id
  )
  SELECT COALESCE(array_agg(key), '{}') INTO created_keys FROM inserted;

  RETURN jsonb_build_object('created', to_jsonb(created_keys));
END;
$$;

-- 3) Guard triggers ───────────────────────────────────────────────────────────

-- System roles are the compatibility anchor for profiles.role — they cannot be
-- deleted, renamed, deactivated, or demoted to non-system.
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'System role "%" cannot be deleted', OLD.name;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system AND (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.is_system IS DISTINCT FROM OLD.is_system
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
  ) THEN
    RAISE EXCEPTION 'System role "%" cannot be renamed, deactivated or demoted', OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_protect_system ON public.roles;
CREATE TRIGGER roles_protect_system
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- Lock-out guard: the admin system role must always keep its permissions.
CREATE OR REPLACE FUNCTION public.protect_admin_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = OLD.role_id AND r.is_system AND r.name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permissions cannot be removed from the admin system role';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS role_permissions_protect_admin ON public.role_permissions;
CREATE TRIGGER role_permissions_protect_admin
  BEFORE DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_role_permissions();

-- 4) RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Role/permission definitions are not secrets — any authenticated user may read
-- them (needed for role labels, and has_permission is SECURITY DEFINER anyway).
DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roles_insert_perm" ON public.roles;
CREATE POLICY "roles_insert_perm" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('roles.create'));

DROP POLICY IF EXISTS "roles_update_perm" ON public.roles;
CREATE POLICY "roles_update_perm" ON public.roles
  FOR UPDATE TO authenticated
  USING (public.has_permission('roles.edit'))
  WITH CHECK (public.has_permission('roles.edit'));

DROP POLICY IF EXISTS "roles_delete_perm" ON public.roles;
CREATE POLICY "roles_delete_perm" ON public.roles
  FOR DELETE TO authenticated
  USING (public.has_permission('roles.delete'));

DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;
CREATE POLICY "permissions_select_authenticated" ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- Direct writes to the catalog are allowed for role managers; the normal path
-- is the sync_permissions() RPC (SECURITY DEFINER, same gate).
DROP POLICY IF EXISTS "permissions_write_perm" ON public.permissions;
CREATE POLICY "permissions_write_perm" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_permission('roles.edit'))
  WITH CHECK (public.has_permission('roles.edit'));

DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_write_perm" ON public.role_permissions;
CREATE POLICY "role_permissions_write_perm" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_permission('roles.edit'))
  WITH CHECK (public.has_permission('roles.edit'));

DROP POLICY IF EXISTS "user_roles_select_own_or_perm" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_perm" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('roles.view'));

DROP POLICY IF EXISTS "user_roles_write_perm" ON public.user_roles;
CREATE POLICY "user_roles_write_perm" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_permission('roles.assign'))
  WITH CHECK (public.has_permission('roles.assign'));

DROP POLICY IF EXISTS "user_permissions_select_own_or_perm" ON public.user_permissions;
CREATE POLICY "user_permissions_select_own_or_perm" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('roles.view'));

DROP POLICY IF EXISTS "user_permissions_write_perm" ON public.user_permissions;
CREATE POLICY "user_permissions_write_perm" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_permission('roles.assign'))
  WITH CHECK (public.has_permission('roles.assign'));

-- 5) Seed: permission catalog ────────────────────────────────────────────────
-- Must stay in sync with src/config/permissions.ts (MODULE_REGISTRY). New
-- entries added there are auto-created at runtime via sync_permissions().

INSERT INTO public.permissions (module, action, description) VALUES
  ('work_orders', 'view',              'View work orders'),
  ('work_orders', 'create',            'Create work orders'),
  ('work_orders', 'edit',              'Edit work orders'),
  ('work_orders', 'delete',            'Delete work orders'),
  ('work_orders', 'assign',            'Assign work orders to teams/collaborators'),
  ('work_orders', 'transition_status', 'Change work order status'),
  ('work_orders', 'bulk_action',       'Run bulk actions on work orders'),
  ('work_orders', 'manage_photos',     'Upload/delete work order photos'),
  ('work_orders', 'manage_documents',  'Upload/delete work order documents'),
  ('work_orders', 'view_billing',      'View work order billing lines'),
  ('work_orders', 'edit_billing',      'Edit work order billing lines'),
  ('work_orders', 'export',            'Export work orders (PDF/Excel)'),
  ('certification', 'view',             'View certification queue'),
  ('certification', 'certify_internal', 'Certify work orders internally'),
  ('certification', 'accept_client',    'Mark client acceptance'),
  ('certification', 'invoice',          'Mark work orders invoiced'),
  ('certification', 'export_excel',     'Export certification Excel'),
  ('certification', 'export_datev',     'Export DATEV CSV'),
  ('certification', 'generate_pdf',     'Generate certificate PDF'),
  ('service_catalog', 'view',          'View service catalog (incl. prices)'),
  ('service_catalog', 'create',        'Create service items'),
  ('service_catalog', 'edit',          'Edit service items'),
  ('service_catalog', 'delete',        'Delete service items'),
  ('service_catalog', 'toggle_active', 'Activate/deactivate service items'),
  ('projects', 'view',       'View projects, clients and operators'),
  ('projects', 'create',     'Create projects/clients/operators'),
  ('projects', 'edit',       'Edit projects/clients/operators'),
  ('projects', 'deactivate', 'Deactivate/reactivate projects'),
  ('users', 'view',   'View operational users'),
  ('users', 'create', 'Create operational users'),
  ('users', 'edit',   'Edit operational users'),
  ('users', 'delete', 'Delete operational users'),
  ('roles', 'view',   'View roles and their members'),
  ('roles', 'create', 'Create roles'),
  ('roles', 'edit',   'Edit roles and their permissions'),
  ('roles', 'delete', 'Delete roles'),
  ('roles', 'assign', 'Assign roles/permissions to users'),
  ('employees', 'view',             'View employees'),
  ('employees', 'create',           'Create employees'),
  ('employees', 'edit',             'Edit employees'),
  ('employees', 'deactivate',       'Deactivate employees'),
  ('employees', 'manage_vacations', 'Approve/reject vacation requests'),
  ('employees', 'generate_payroll', 'Generate payroll slips'),
  ('onboarding', 'view',             'View subcontractor onboarding'),
  ('onboarding', 'edit',             'Edit subcontractor onboarding'),
  ('onboarding', 'generate_pdf',     'Generate onboarding PDF'),
  ('onboarding', 'review_documents', 'Upload/review contractor documents'),
  ('materials', 'view',                 'View materials and vehicle stock'),
  ('materials', 'create',               'Create materials/vehicles'),
  ('materials', 'edit',                 'Edit materials/vehicles/stock'),
  ('materials', 'deactivate',           'Deactivate materials/vehicles'),
  ('materials', 'import',               'Import material workbooks'),
  ('materials', 'register_consumption', 'Register material consumption'),
  ('cycles', 'view',    'View collaborator cycles'),
  ('cycles', 'create',  'Create collaborator cycles'),
  ('cycles', 'edit',    'Edit collaborator cycles'),
  ('cycles', 'delete',  'Delete collaborator cycles'),
  ('cycles', 'publish', 'Publish/unpublish collaborator cycles'),
  ('settings', 'view',             'View settings'),
  ('settings', 'manage_telegram',  'Manage Telegram groups and mappings'),
  ('settings', 'manage_team_pins', 'Manage team PINs'),
  ('dashboard', 'view', 'View admin dashboard'),
  ('appointments', 'view',     'View all appointments'),
  ('appointments', 'create',   'Create appointments'),
  ('appointments', 'edit',     'Edit/reschedule appointments'),
  ('appointments', 'confirm',  'Confirm appointments'),
  ('appointments', 'complete', 'Complete appointments'),
  ('appointments', 'cancel',   'Cancel appointments'),
  ('portal', 'admin.access',     'Access the admin portal'),
  ('portal', 'tech.access',      'Access the technician portal'),
  ('portal', 'contractor.access','Access the contractor portal'),
  ('portal', 'scheduler.access', 'Access the scheduler portal')
ON CONFLICT (module, action) DO NOTHING;

-- 6) Seed: system roles ──────────────────────────────────────────────────────
-- NOTE: technician/contractor/scheduler get ONLY their portal-access permission.
-- Their data access is (and stays) enforced by the ownership/scope RLS policies
-- keyed on profiles.role — granting them module permissions here would widen
-- their reach through the permission-based policies added in 035.

INSERT INTO public.roles (name, description, is_system, auto_grant_new, is_active) VALUES
  ('admin',      'Full administrative access (system role)',            true, true,  true),
  ('technician', 'Internal field collaborator portal (system role)',    true, false, true),
  ('contractor', 'External subcontractor portal (system role)',         true, false, true),
  ('scheduler',  'Appointment scheduler portal (system role)',          true, false, true)
ON CONFLICT (name) DO NOTHING;

-- admin → every permission
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' AND r.is_system
ON CONFLICT DO NOTHING;

-- field/scheduler personas → portal access only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p
  ON p.key = 'portal.' ||
     CASE r.name
       WHEN 'technician' THEN 'tech'
       WHEN 'contractor' THEN 'contractor'
       WHEN 'scheduler'  THEN 'scheduler'
     END || '.access'
WHERE r.name IN ('technician', 'contractor', 'scheduler') AND r.is_system
ON CONFLICT DO NOTHING;

-- 7) Backfill + keep profiles.role in sync with user_roles ───────────────────

INSERT INTO public.user_roles (user_id, role_id)
SELECT pf.id, r.id
FROM public.profiles pf
JOIN public.roles r ON r.is_system AND r.name = pf.role::text
ON CONFLICT DO NOTHING;

-- profiles.role remains the base persona. When it changes (UsersPage, Edge
-- Function admin-users), swap the matching system role in user_roles without
-- touching custom role assignments.
CREATE OR REPLACE FUNCTION public.sync_user_role_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.user_roles ur
  USING public.roles r
  WHERE ur.user_id = NEW.id
    AND ur.role_id = r.id
    AND r.is_system
    AND r.name <> NEW.role::text;

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, r.id
  FROM public.roles r
  WHERE r.is_system AND r.name = NEW.role::text
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_user_role ON public.profiles;
CREATE TRIGGER profiles_sync_user_role
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_from_profile();
