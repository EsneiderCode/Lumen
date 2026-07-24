/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const migrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n')
  .toLowerCase()
const notificationServiceSource = readFileSync(
  join(process.cwd(), 'src', 'services', 'notificationService.ts'),
  'utf8',
).toLowerCase()
const supabaseConfig = readFileSync(
  join(process.cwd(), 'supabase', 'config.toml'),
  'utf8',
).toLowerCase()
const migration022Sql = readFileSync(
  join(migrationsDir, '022_service_item_categories.sql'),
  'utf8',
)
const migration024Sql = readFileSync(
  join(migrationsDir, '024_employee_teams.sql'),
  'utf8',
).toLowerCase()
const migration025Sql = readFileSync(
  join(migrationsDir, '025_work_order_source.sql'),
  'utf8',
)

describe('database migrations cover billing workflow schema', () => {
  it('allows direct orders without a client', () => {
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?work_orders[\s\S]*alter\s+column\s+client_id\s+drop\s+not\s+null/,
    )
  })

  it('adds external pricing to service items', () => {
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?service_items[\s\S]*add\s+column\s+if\s+not\s+exists\s+unit_price_external/,
    )
  })

  it('creates billing lines with price snapshots', () => {
    expect(migrationSql).toContain('create table if not exists public.work_order_billing_lines')
    expect(migrationSql).toContain('unit_price_snapshot')
    expect(migrationSql).toContain('unit_price_external_snapshot')
  })

  // Regression guard: 005 created work_order_billing_lines WITHOUT
  // unit_price_external_snapshot, and 009 re-declared it via CREATE TABLE IF NOT
  // EXISTS — a no-op on the already-existing table, so the column was never
  // added even though it appears in the concatenated SQL above. The app writes
  // it on every external-collaborator billing save, so an explicit ALTER ... ADD
  // COLUMN must exist for the live schema to be correct.
  it('actually adds the external price snapshot column to billing lines via ALTER', () => {
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?work_order_billing_lines[\s\S]*add\s+column\s+if\s+not\s+exists\s+unit_price_external_snapshot/,
    )
  })

  it('allows external certification audit rows', () => {
    expect(migrationSql).toMatch(/cert_type[\s\S]*internal[\s\S]*client[\s\S]*external/)
  })

  it('stores field PINs as hashes behind login codes', () => {
    expect(migrationSql).toContain('pin_login_code')
    expect(migrationSql).toContain('pin_hash')
    expect(migrationSql).toContain('revoke select (pin_hash)')
  })

  it('tracks trusted PIN devices for offline-first field login', () => {
    expect(migrationSql).toContain('create table if not exists public.pin_trusted_devices')
    expect(migrationSql).toContain('device_id_hash')
  })

  it('tracks contractor compliance documents', () => {
    expect(migrationSql).toContain('create table if not exists public.contractor_documents')
    expect(migrationSql).toContain('gewerbeanmeldung')
    expect(migrationSql).toContain('haftpflichtversicherung')
    expect(migrationSql).toContain('unbedenklichkeit_finanzamt')
    expect(migrationSql).toContain('unbedenklichkeit_sozialkasse')
    expect(migrationSql).toContain('id_passport')
    expect(migrationSql).toContain('subcontractor_agreement')
  })

  it('blocks external certification when contractor documents are invalid', () => {
    expect(migrationSql).toContain('contractor_documents_are_valid')
    expect(migrationSql).toContain('block_external_cert_without_valid_docs')
    expect(migrationSql).toContain('enforce_external_cert_documents')
  })

  it('tracks material inventory by vehicle and Rückmeldung consumption', () => {
    expect(migrationSql).toContain('create table if not exists public.inventory_vehicles')
    expect(migrationSql).toContain('create table if not exists public.vehicle_material_stock')
    expect(migrationSql).toContain(
      'create table if not exists public.work_order_material_consumptions',
    )
    expect(migrationSql).toContain('create table if not exists public.stock_movements')
    expect(migrationSql).toContain('catalog_source')
    expect(migrationSql).toContain('idx_materials_catalog_sku_unique')
    expect(migrationSql).toContain('movement_type')
    expect(migrationSql).toContain('tech_correction')
  })

  it('locks down profile self-updates that could change authorization fields', () => {
    expect(migrationSql).toContain('013_lock_down_profile_self_updates')
    expect(migrationSql).toContain('drop policy if exists "users can update own profile"')
    expect(migrationSql).toContain('drop policy if exists "profiles_update_own"')
    expect(migrationSql).toContain('drop policy if exists "profiles_update_admin"')
    expect(migrationSql).toMatch(
      /create\s+policy\s+"profiles_update_admin"[\s\S]*with check \(public\.get_user_role\(\) = 'admin'\)/,
    )
  })

  it('keeps Telegram bot credentials out of the browser bundle', () => {
    expect(notificationServiceSource).not.toContain('vite_telegram_bot_token')
    expect(notificationServiceSource).toContain("functions.invoke('send-telegram'")
    expect(supabaseConfig).toContain('[functions.send-telegram]')
    expect(supabaseConfig).toContain('verify_jwt = true')
  })

  it('routes Telegram notifications through per-order group assignments', () => {
    expect(migrationSql).toContain('create table public.work_order_telegram_groups')
    expect(migrationSql).toContain('unique (work_order_id, telegram_group_id)')
    expect(migrationSql).toMatch(
      /create\s+policy\s+"wo_telegram_groups_insert_perm"[\s\S]*has_permission\('work_orders\.edit'\)/,
    )
    // Per-user routing (migration 038) is superseded and dropped.
    expect(migrationSql).toContain('drop table if exists public.user_telegram_groups')
    // Every order-scoped notify function forwards the order id so the edge
    // function can target only that order's groups; deletion pre-resolves the
    // group ids because the assignment rows cascade away with the order.
    expect(notificationServiceSource).toContain('orderid')
    expect(notificationServiceSource).toContain('groupids')
    const edgeFunctionSource = readFileSync(
      join(process.cwd(), 'supabase', 'functions', 'send-telegram', 'index.ts'),
      'utf8',
    ).toLowerCase()
    expect(edgeFunctionSource).toContain('work_order_telegram_groups?select=telegram_group_id')
    // Open events must not honor caller-supplied explicit group ids.
    expect(edgeFunctionSource).toContain('open_event_types.has(body.type)')
    // Messages are enriched server-side from the live order (full card:
    // project, address, team member list, notes) and attached documents are
    // delivered to the chats on assignment.
    expect(edgeFunctionSource).toContain('work_orders?select=')
    expect(edgeFunctionSource).toContain('senddocument')
  })

  it('keeps pricing admin-only outside certification/accounting screens', () => {
    expect(migrationSql).toContain('migration 014')
    expect(migrationSql).toContain('drop policy if exists "si_read_active"')
    expect(migrationSql).toContain('create view public.service_items_public')
    expect(migrationSql).not.toContain('si.unit_price')
    expect(migrationSql).not.toContain('si.unit_price_external')
    expect(migrationSql).toContain('drop policy if exists "wobl_assignee_select"')
    expect(migrationSql).toMatch(
      /create\s+policy\s+"wobl_admin_all"[\s\S]*with check \(public\.get_user_role\(\) = 'admin'\)/,
    )
  })

  it('stores technician-reported Alta service items outside billing lines', () => {
    expect(migrationSql).toContain('migration 015')
    expect(migrationSql).toContain('depends on: 014_lock_down_service_pricing.sql')
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?wo_detail_alta[\s\S]*add\s+column\s+if\s+not\s+exists\s+reported_service_items\s+jsonb\s+not\s+null\s+default\s+'\[\]'::jsonb/,
    )
    expect(migrationSql).toContain('wo_detail_alta_reported_service_items_array')
    expect(migrationSql).toContain("check (jsonb_typeof(reported_service_items) = 'array')")
  })

  it('hardens contractor assignment and lifecycle RPC boundaries', () => {
    expect(migrationSql).toContain('migration 016')
    expect(migrationSql).toContain('depends on: 015_store_reported_service_items.sql')
    expect(migrationSql).toContain('contractor_document_compliance_failures')
    expect(migrationSql).toContain('block_non_compliant_contractor_assignment')
    expect(migrationSql).toContain('enforce_work_order_assignment_compliance')
    expect(migrationSql).toContain('assign_work_order_checked')
    expect(migrationSql).toContain('certify_work_order_internal')
    expect(migrationSql).toContain('accept_work_order_client')
    expect(migrationSql).toContain('invoice_work_order_checked')
    expect(migrationSql).toContain('assert_work_order_rueckmeldung_complete')
    expect(migrationSql).toContain('work_order_photos')
    expect(migrationSql).toContain('fehlende fotos')
    expect(migrationSql).toContain('length(trim(p_data_hash)) > 0')
  })

  it('documents direct-order semantics and preflight remediation before hard blockers', () => {
    expect(migrationSql).toContain('client_id is null')
    expect(migrationSql).toContain('assigned_collaborator_id does not define direct-order status')
    expect(migrationSql).toContain('preflight')
    expect(migrationSql).toContain('client_accepted')
    expect(migrationSql).toContain("cert_type = 'client'")
    expect(migrationSql).toContain("cert_type = 'internal'")
  })

  it('adds category grouping to service catalog and seeds the NE4 rate card', () => {
    expect(migrationSql).toContain('migration 022')
    expect(migrationSql).toContain('depends on: 021_team_pins.sql')
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?service_items\s+add\s+column\s+if\s+not\s+exists\s+category\s+text/,
    )
    expect(migrationSql).toContain('ne4 > ont / aktivierung')
    expect(migrationSql).toContain('ne4 > hausanschluss / nas / acometida cliente')
    expect(migrationSql).toContain('ne4 > altas cliente deutsche glasfaser / ugg')
    expect(migrationSql).toContain('ne4 > replanteo / citas / activaciones posteriores')
    expect(migrationSql).toContain('ne4 > suplementos / mehraufwand')
    expect(migration022Sql).toContain("'WESTC'")
    expect(migration022Sql).not.toContain('WESTCONNECT')
  })

  it('adds project defaults for order-form derivation', () => {
    expect(migrationSql).toContain('migration 023')
    expect(migrationSql).toContain('depends on: 022_service_item_categories.sql')
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?projects[\s\S]*add\s+column\s+if\s+not\s+exists\s+default_operator_id/,
    )
    expect(migrationSql).toContain('default_line')
  })

  it('adds employee teams and app-profile links', () => {
    expect(migrationSql).toContain('migration 024')
    expect(migration024Sql).toContain('depends on: 023_project_defaults.sql')
    expect(migration024Sql).toMatch(
      /alter\s+table\s+(public\.)?employees[\s\S]*add\s+column\s+if\s+not\s+exists\s+team\s+(public\.)?team_color/,
    )
    expect(migration024Sql).toMatch(
      /add\s+column\s+if\s+not\s+exists\s+profile_id\s+uuid\s+references\s+public\.profiles\(id\)/,
    )
    expect(migration024Sql).toContain('idx_employees_team')
  })

  it('adds NE4 bridge provenance columns to work_orders', () => {
    expect(migration025Sql).toContain('Depends on: 024_employee_teams.sql')
    expect(migration025Sql).toMatch(
      /source TEXT NOT NULL DEFAULT 'lumen'/,
    )
    expect(migration025Sql).toContain('external_metadata JSONB')
  })

  it('adds the scheduler role enum value in its own migration', () => {
    expect(migrationSql).toContain('depends on: 026_telegram_event_types.sql')
    expect(migrationSql).toMatch(
      /alter\s+type\s+(public\.)?user_role\s+add\s+value\s+if\s+not\s+exists\s+'scheduler'/,
    )
  })

  it('adds appointments table and scheduler scope with scoped RLS', () => {
    expect(migrationSql).toContain('depends on: 027_user_role_scheduler.sql')
    expect(migrationSql).toMatch(
      /alter\s+table\s+(public\.)?profiles[\s\S]*add\s+column\s+if\s+not\s+exists\s+scheduler_line/,
    )
    expect(migrationSql).toContain('scheduler_operator')
    expect(migrationSql).toContain('create table if not exists public.appointments')
    expect(migrationSql).toContain('appointments_line_operator_idx')
    expect(migrationSql).toContain('appointments_admin_all')
    expect(migrationSql).toContain('appointments_scheduler_scope')
    expect(migrationSql).toMatch(
      /create\s+policy\s+appointments_scheduler_scope[\s\S]*public\.get_user_role\(\)\s*=\s*'scheduler'/,
    )
  })

  it('adds dynamic RBAC tables, helpers and seeds (034)', () => {
    expect(migrationSql).toContain('depends on: 033_subcontractor_onboarding.sql')
    expect(migrationSql).toContain('create table if not exists public.roles')
    expect(migrationSql).toContain('create table if not exists public.permissions')
    expect(migrationSql).toContain('create table if not exists public.role_permissions')
    expect(migrationSql).toContain('create table if not exists public.user_roles')
    expect(migrationSql).toContain('create table if not exists public.user_permissions')
    // effective-permission helpers used by RLS, Edge Functions and the frontend
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.user_has_permission\(uid\s+uuid,\s*perm\s+text\)/,
    )
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.has_permission\(perm\s+text\)/)
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.get_my_permissions\(\)/)
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.sync_permissions\(perms\s+jsonb\)/)
    // system roles seeded and protected; profiles.role stays synced into user_roles
    expect(migrationSql).toContain('roles_protect_system')
    expect(migrationSql).toContain('role_permissions_protect_admin')
    expect(migrationSql).toContain('profiles_sync_user_role')
    expect(migrationSql).toMatch(/insert\s+into\s+public\.user_roles\s*\(user_id,\s*role_id\)/)
    // portal-access permissions exist for the field personas
    expect(migrationSql).toContain("'portal', 'tech.access'")
    expect(migrationSql).toContain("'portal', 'contractor.access'")
    expect(migrationSql).toContain("'portal', 'scheduler.access'")
  })

  it('adds the compliance module core schema (042–044)', () => {
    expect(migrationSql).toContain('depends on: 044_compliance_seed_matrix.sql')
    // catalog + matrix + unified entities + versioned documents
    expect(migrationSql).toContain('create table public.document_types')
    expect(migrationSql).toContain('create table public.document_requirements')
    expect(migrationSql).toContain('create table public.compliance_entities')
    expect(migrationSql).toContain('create table public.entity_documents')
    expect(migrationSql).toContain('create table public.document_versions')
    expect(migrationSql).toContain('create table public.document_reviews')
    expect(migrationSql).toContain('create table public.document_access_log')
    expect(migrationSql).toContain('create table public.project_assignments')
    // aptitude engine mirrors src/services/complianceRequirementEngine.ts
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.country_origin_bucket/)
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.applicable_requirement_ids/)
    expect(migrationSql).toMatch(/create\s+or\s+replace\s+function\s+public\.compute_entity_aptitude/)
    expect(migrationSql).toContain('project_assignments_enforce_aptitude')
    expect(migrationSql).toContain('run_compliance_expiry_sweep')
    // JSONB containment drives conditional requirements (hires_workers etc.)
    expect(migrationSql).toContain('r.conditions <@ e.attributes')
    expect(migrationSql).toContain('"hires_workers": true')
    // seed covers the key document types of the initial matrix
    expect(migrationSql).toContain("'a1_certificate'")
    expect(migrationSql).toContain("'soka_bau_clearance'")
    expect(migrationSql).toContain("'freistellung_48b'")
    expect(migrationSql).toContain("'zoll_meldeportal_notification'")
    expect(migrationSql).toContain("'work_permit_vander_elst'")
    expect(migrationSql).toContain('notify_billing_withholding')
    // expiry jobs run on Berlin time
    expect(migrationSql).toContain("at time zone 'europe/berlin'")
  })

  it('migrates legacy contractor data and rewires the external cert gate (045)', () => {
    expect(migrationSql).toContain('045 — migrate legacy contractor data')
    // legacy docs land in the new model with history preserved
    expect(migrationSql).toMatch(/'a1_bescheinigung',\s*'a1_certificate'/)
    expect(migrationSql).toContain("'contractor-documents'")
    // the cert gate now consults the aptitude engine (legacy check transitional)
    expect(migrationSql).toMatch(
      /block_external_cert_without_valid_docs[\s\S]*compute_entity_aptitude/,
    )
    expect(migrationSql).toContain('deprecated: superseded by entity_documents')
  })

  it('retires the legacy contractor-document gates in favour of the aptitude engine (046)', () => {
    expect(migrationSql).toContain('depends on: 045_compliance_legacy_migration.sql')
    // both gates now consult compute_entity_aptitude() and nothing else
    expect(migrationSql).toMatch(
      /block_external_cert_without_valid_docs[\s\S]*compute_entity_aptitude/,
    )
    expect(migrationSql).toMatch(
      /block_non_compliant_contractor_assignment[\s\S]*compute_entity_aptitude/,
    )
    // a contractor with no compliance entity is now blocked outright
    expect(migrationSql).toContain('contractor has no compliance record')
    // legacy helper is marked deprecated
    expect(migrationSql).toContain('deprecated (046)')
    // the dead 'onboarding' RBAC permission module is dropped (admin-protect
    // trigger disabled for the cascade, then re-enabled)
    expect(migrationSql).toMatch(
      /disable trigger role_permissions_protect_admin[\s\S]*delete from public\.permissions where module = 'onboarding'[\s\S]*enable trigger role_permissions_protect_admin/,
    )
  })

  it('adds an audited override to the contractor-assignment gate (047)', () => {
    expect(migrationSql).toContain('depends on: 046_compliance_retire_legacy_gates.sql')
    // the four override/audit columns land on work_orders
    expect(migrationSql).toMatch(
      /alter\s+table\s+public\.work_orders[\s\S]*compliance_override[\s\S]*compliance_override_reason[\s\S]*compliance_override_by[\s\S]*compliance_override_at/,
    )
    // the gate still consults the aptitude engine…
    expect(migrationSql).toMatch(
      /block_non_compliant_contractor_assignment[\s\S]*compute_entity_aptitude/,
    )
    // …but a red result is force-allowed only with a non-empty justified override
    expect(migrationSql).toMatch(
      /new\.compliance_override[\s\S]*btrim\(new\.compliance_override_reason\)\s*<>\s*''/,
    )
  })

  it('adds the compliance notifications inbox + sweep fan-out (048)', () => {
    expect(migrationSql).toContain('depends on: 047_compliance_assignment_override.sql')
    // extensions for scheduling + outbound HTTP
    expect(migrationSql).toContain('create extension if not exists pg_cron')
    expect(migrationSql).toContain('create extension if not exists pg_net')
    // in-app inbox table + idempotent dedupe index + RLS
    expect(migrationSql).toContain('create table if not exists public.notifications')
    expect(migrationSql).toContain('idx_notifications_dedupe')
    expect(migrationSql).toMatch(
      /create\s+policy\s+"notifications_own_select"[\s\S]*recipient_id\s*=\s*auth\.uid\(\)/,
    )
    // the sweep now returns rows and writes notifications for compliance.review holders
    expect(migrationSql).toMatch(
      /create\s+function\s+public\.run_compliance_expiry_sweep\(\)[\s\S]*returns\s+table/,
    )
    expect(migrationSql).toMatch(
      /insert\s+into\s+public\.notifications[\s\S]*user_has_permission\(pr\.id,\s*'compliance\.review'\)/,
    )
    // review → owner notification trigger
    expect(migrationSql).toContain('document_reviews_notify_owner')
    // daily schedule invoking the compliance-notify Edge Function
    expect(migrationSql).toMatch(/cron\.schedule\(\s*'lumen-compliance-daily'/)
    expect(migrationSql).toContain('/functions/v1/compliance-notify')
  })

  it('registers the compliance email + notify Edge Functions (048)', () => {
    expect(supabaseConfig).toContain('[functions.send-email]')
    expect(supabaseConfig).toMatch(/\[functions\.compliance-notify\][\s\S]*verify_jwt\s*=\s*true/)
  })

  it('adds template storage policies readable by the whole workforce (049)', () => {
    expect(migrationSql).toContain('depends on: 048_compliance_notifications.sql')
    // any authenticated user may read blank templates under templates/
    expect(migrationSql).toMatch(
      /create\s+policy\s+"storage_compliance_templates_read"[\s\S]*\(storage\.foldername\(name\)\)\[1\]\s*=\s*'templates'/,
    )
    // writes are gated to matrix configurators
    expect(migrationSql).toMatch(
      /storage_compliance_templates_insert[\s\S]*has_permission\('compliance\.configure_matrix'\)/,
    )
    expect(migrationSql).toContain('storage_compliance_templates_delete')
  })

  it('adds the GDPR retention sweep + monthly cron (050)', () => {
    expect(migrationSql).toContain('depends on: 049_compliance_document_templates.sql')
    // retention sweep purges the access log, SECURITY DEFINER (no DELETE RLS)
    expect(migrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.run_compliance_retention_sweep\(retain_days\s+integer/,
    )
    expect(migrationSql).toMatch(
      /delete\s+from\s+public\.document_access_log[\s\S]*created_at\s*<\s*now\(\)/,
    )
    expect(migrationSql).toContain('security definer')
    // not callable by app roles
    expect(migrationSql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.run_compliance_retention_sweep\(integer\)\s+from\s+public,\s*anon,\s*authenticated/,
    )
    // scheduled monthly as a pure SQL call (no Edge Function)
    expect(migrationSql).toMatch(/cron\.schedule\(\s*'lumen-compliance-retention'/)
    expect(migrationSql).toContain('select public.run_compliance_retention_sweep();')
  })

  it("widens document_access_log.action to allow 'upload' (051)", () => {
    expect(migrationSql).toContain('depends on: 050_compliance_retention.sql')
    // the old two-value constraint is dropped and re-added with 'upload'
    expect(migrationSql).toMatch(
      /drop\s+constraint\s+if\s+exists\s+document_access_log_action_check/,
    )
    expect(migrationSql).toMatch(
      /add\s+constraint\s+document_access_log_action_check[\s\S]*check\s*\(action\s+in\s*\(\s*'view',\s*'download',\s*'upload'\s*\)\)/,
    )
  })

  it('registers the compliance-ocr Edge Function (6c)', () => {
    expect(supabaseConfig).toMatch(/\[functions\.compliance-ocr\][\s\S]*verify_jwt\s*=\s*true/)
  })

  it('rewrites admin-gated RLS policies to permission checks (035)', () => {
    expect(migrationSql).toContain('depends on: 034_rbac_core.sql')
    // the old role-literal admin gates must be dropped…
    expect(migrationSql).toContain('drop policy if exists "admins full access to work orders"')
    expect(migrationSql).toContain('drop policy if exists "profiles_update_admin"')
    // …including 005's billing_lines_admin, which 009/014 never removed
    expect(migrationSql).toContain('drop policy if exists "billing_lines_admin"')
    // …and replaced by has_permission() checks per module.action
    expect(migrationSql).toMatch(
      /create\s+policy\s+"work_orders_delete_perm"[\s\S]*public\.has_permission\('work_orders\.delete'\)/,
    )
    expect(migrationSql).toMatch(
      /create\s+policy\s+"profiles_update_perm"[\s\S]*public\.has_permission\('users\.edit'\)/,
    )
    expect(migrationSql).toMatch(
      /create\s+policy\s+"cert_audits_write_perm"[\s\S]*public\.has_permission\('certification\.certify_internal'\)/,
    )
    // ownership/scope policies stay keyed on the base persona
    expect(migrationSql).toContain('appointments_scheduler_scope')
  })
})
