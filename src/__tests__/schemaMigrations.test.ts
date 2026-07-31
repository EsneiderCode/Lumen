/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
const migration064Sql = readFileSync(
  join(migrationsDir, '064_work_order_site_reference.sql'),
  'utf8',
)
const clientFirstMigrations = [
  ['065_client_master_data.sql', '064_work_order_site_reference.sql'],
  ['066_client_owned_service_catalog.sql', '065_client_master_data.sql'],
  ['067_executor_master_data.sql', '066_client_owned_service_catalog.sql'],
  ['068_client_first_work_order_routing.sql', '067_executor_master_data.sql'],
  ['069_executor_certification_paths.sql', '068_client_first_work_order_routing.sql'],
] as const

// `supabase/rls_policies.sql` is the second hand-applied DDL source (see README):
// the work_orders policies and every work-order-photos storage policy live there,
// not in a migration. Migration 073 rewrites both, so both have to be asserted.
const rlsPoliciesSql = readFileSync(
  join(process.cwd(), 'supabase', 'rls_policies.sql'),
  'utf8',
).toLowerCase()

function readRequiredMigration(file: string) {
  const path = join(migrationsDir, file)
  expect(existsSync(path), `${file} must exist`).toBe(true)
  return readFileSync(path, 'utf8')
}

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
    // project, address, team member list, notes). The order's attachments are
    // out of scope entirely: neither the files nor their names ever leave LUMEN.
    expect(edgeFunctionSource).toContain('work_orders?select=')
    expect(edgeFunctionSource).not.toContain('work_order_documents')
    expect(edgeFunctionSource).not.toContain('senddocument')
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

  // A company adding a worker sends INSERT ... RETURNING (createEntity does
  // .insert().select().single()). Postgres applies the SELECT policies to the
  // returned row, and owns_compliance_entity(id) cannot see a row its own
  // statement just created — so the insert came back as 42501 for two months.
  // The fix judges the row by its parent, which already exists.
  it('lets an owner read a child entity from its parent, so RETURNING works (057)', () => {
    expect(migrationSql).toContain('depends on: 042_compliance_core.sql')
    expect(migrationSql).toMatch(
      /create\s+policy\s+"compliance_entities_own_child_select"[\s\S]*for\s+select[\s\S]*parent_entity_id\s+is\s+not\s+null[\s\S]*owns_compliance_entity\(parent_entity_id\)/,
    )
    // The insert policy it unblocks must stay keyed on the parent too.
    expect(migrationSql).toMatch(
      /create\s+policy\s+"compliance_entities_own_worker_insert"[\s\S]*owns_compliance_entity\(parent_entity_id\)/,
    )
  })

  // Sin estas tres columnas la lista de órdenes solo puede decir «Soplado», que
  // es exactamente lo que no distingue una orden de otra.
  it('adds the site reference (tramo, POP, DP) to work orders (064)', () => {
    expect(migration064Sql).toContain('Depends on: 025_work_order_source.sql')
    expect(migration064Sql).toMatch(
      /ALTER TABLE public\.work_orders[\s\S]*ADD COLUMN IF NOT EXISTS segment_kind TEXT/,
    )
    expect(migration064Sql).toContain('ADD COLUMN IF NOT EXISTS pop_code')
    expect(migration064Sql).toContain('ADD COLUMN IF NOT EXISTS dp_code')
    // El CHECK admite NULL a propósito: las órdenes que ya existen no tienen tramo.
    expect(migration064Sql).toMatch(
      /CHECK \(segment_kind IS NULL OR segment_kind IN \('ra', 'rd'\)\)/,
    )
    // Y se declara con DROP previo, o reaplicar la migración falla por duplicado.
    expect(migration064Sql).toContain('DROP CONSTRAINT IF EXISTS work_orders_segment_kind_check')
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

  it.each(clientFirstMigrations)(
    'ships %s with the correct sequential dependency',
    (file, dependency) => {
      const sql = readRequiredMigration(file)
      expect(sql).toContain(`-- Depends on: ${dependency}`)
    },
  )

  it('promotes clients and projects to safe client-owned master data (065)', () => {
    const sql = readRequiredMigration('065_client_master_data.sql').toLowerCase()
    expect(sql).not.toContain('alter column client_id set not null')
    expect(sql).toContain('projects.client_id not null enforcement is deferred to migration 070')
    expect(sql).toContain('projects_client_code_unique')
    expect(sql).toContain('projects_null_client_code_unique')
    expect(sql).toMatch(
      /if\s+conflicting_projects\s+is\s+not\s+null\s+then[\s\S]*raise\s+exception[\s\S]*conflicting project/,
    )
    expect(sql).toMatch(/unresolved project[\s\S]*raise\s+notice/)
    expect(sql).toMatch(
      /revoke\s+select\s+on\s+public\.clients\s+from\s+anon,\s*authenticated/,
    )
    expect(sql).toMatch(
      /has_permission\('projects\.view'\)[\s\S]*select\s+client\.notes/,
    )
    expect(sql).toContain('backfilled project client ownership rows: %')
  })

  it('makes selectable catalog rows client-owned while preserving legacy rows (066)', () => {
    const sql = readRequiredMigration('066_client_owned_service_catalog.sql').toLowerCase()
    expect(sql).toContain('legacy_only')
    expect(sql).not.toContain('add constraint service_items_client_required_unless_legacy')
    expect(sql).toContain('client-required check is deferred to migration 070')
    expect(sql).toContain('service_items_client_code_unique')
    expect(sql).toContain('owner-editable catalog cloning map')
    expect(sql).toContain('si.legacy_only')
    expect(sql).toContain('left join public.clients')
    expect(sql).toMatch(/where\s+si\.active\s*=\s*true[\s\S]*si\.is_pass_through\s*=\s*false/)
  })

  it('normalizes teams and links both personnel sources (067)', () => {
    const sql = readRequiredMigration('067_executor_master_data.sql').toLowerCase()
    expect(sql).toContain('create table if not exists public.teams')
    expect(sql).toMatch(/alter table public\.employees[\s\S]*add column if not exists team_id/)
    expect(sql).toMatch(/alter table public\.profiles[\s\S]*add column if not exists team_id/)
    expect(sql).toContain('teams_select')
    expect(sql).toContain('teams_update_perm')
    expect(sql).toContain('backfilled employee team rows: %')
    expect(sql).toContain('backfilled profile team rows: %')
    expect(sql).not.toContain('reuse compliance_entities')
  })

  it('adds the v2 executor contract and omits operator/line (068)', () => {
    const sql = readRequiredMigration('068_client_first_work_order_routing.sql').toLowerCase()
    expect(sql).toContain('work_order_executor_type')
    expect(sql).toContain('flow_version')
    expect(sql).toContain('executor_team_id')
    expect(sql).toContain('executor_entity_id')
    expect(sql).toMatch(/alter column operator_id drop not null/)
    expect(sql).toMatch(/alter column line drop not null/)
    expect(sql).toContain('validate_client_first_work_order')
    expect(sql).toContain('routing is frozen from in_progress')
    expect(sql).toContain('v1 work orders require operator_id and line')
    expect(sql).toContain('v2 work orders omit operator_id and line')
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.validate_client_first_work_order\(\)[\s\S]*security\s+definer[\s\S]*set\s+search_path\s*=\s*public,\s*pg_temp/,
    )
    expect(sql).toMatch(
      /if\s+tg_op\s*=\s*'update'[\s\S]*new\.flow_version\s+is\s+not\s+distinct\s+from\s+old\.flow_version[\s\S]*new\.client_id\s+is\s+not\s+distinct\s+from\s+old\.client_id[\s\S]*new\.project_id\s+is\s+not\s+distinct\s+from\s+old\.project_id[\s\S]*new\.service_item_id\s+is\s+not\s+distinct\s+from\s+old\.service_item_id[\s\S]*new\.executor_type\s+is\s+not\s+distinct\s+from\s+old\.executor_type[\s\S]*new\.executor_team_id\s+is\s+not\s+distinct\s+from\s+old\.executor_team_id[\s\S]*new\.executor_entity_id\s+is\s+not\s+distinct\s+from\s+old\.executor_entity_id[\s\S]*new\.operator_id\s+is\s+not\s+distinct\s+from\s+old\.operator_id[\s\S]*new\.line\s+is\s+not\s+distinct\s+from\s+old\.line[\s\S]*new\.is_direct_order\s+is\s+not\s+distinct\s+from\s+old\.is_direct_order[\s\S]*return\s+new/,
    )
    expect(sql).toContain('backfilled external_contractor from assigned_collaborator_id: %')
    expect(sql).toContain('backfilled external_contractor from assigned_technician: %')
    expect(sql).toContain('backfilled own_team from internal employee: %')
    expect(sql).toContain('backfilled own_team from legacy assigned_team: %')
    expect(sql).toContain('rollback notes:')
  })

  it('branches v2 certification through checked RPCs while preserving v1 (069)', () => {
    const sql = readRequiredMigration('069_executor_certification_paths.sql').toLowerCase()
    expect(sql).toContain('new.flow_version = 1')
    expect(sql).toContain('send_work_order_to_client_checked')
    expect(sql).toContain('reject_work_order_client_checked')
    expect(sql).toContain('reopen_rejected_work_order_checked')
    expect(sql).toContain("executor_type <> 'external_contractor'")
    expect(sql).toContain("executor_type = 'own_team'")
    expect(sql).toContain("current_setting('lumen.certification_rpc', true)")
    expect(sql).toContain('revoke all on function')
    expect(sql).toContain('grant execute on function')
    expect(sql).toMatch(
      /old\.status\s*=\s*'rueckmeldung_sent'[\s\S]*new\.executor_type\s*=\s*'own_team'\s+and\s+new\.status\s*=\s*'sent_to_client'/,
    )
    expect(sql).not.toMatch(
      /new\.executor_type\s*=\s*'own_team'\s+and\s+new\.status\s*=\s*'internally_certified'/,
    )
    expect(sql).toMatch(
      /old\.status\s*=\s*'rueckmeldung_sent'[\s\S]*new\.executor_type\s*=\s*'external_contractor'\s+and\s+new\.status\s*=\s*'internally_certified'/,
    )
    expect(sql).toMatch(
      /old\.status\s*=\s*'internally_certified'\s+and\s+new\.executor_type\s*=\s*'external_contractor'\s+and\s+new\.status\s+in\s*\(\s*'sent_to_client',\s*'cancelled'\s*\)/,
    )
    expect(sql).toContain('rollback notes:')
  })
})

// ── Migration 073 — one order, one responsible technician ───────────────────
//
// The owner's rule: a technician may only ever see what belongs to the order
// assigned to them, and every order has exactly ONE responsible person. What
// made that false was never `work_orders` itself — that table has always been
// scoped to `assigned_technician = auth.uid()` — but everything hanging off it:
// documents, the documents bucket and, worst of all, the photos bucket, which
// let any authenticated user read and write every photo of every order.
describe('migration 073 scopes work order access to the single assignee', () => {
  const sql = readRequiredMigration('073_work_order_access_scope.sql').toLowerCase()
  // The header quotes the OLD policies verbatim so the rollback notes can be
  // pasted and run. Assertions about what this migration *does* must therefore
  // read the executable body only, or they match the rollback snippets instead.
  const body = sql.slice(sql.indexOf('\nbegin;'))

  it('declares its place in the sequence', () => {
    expect(readRequiredMigration('073_work_order_access_scope.sql')).toContain(
      '-- Depends on: 072_revoke_anon_assign_work_order.sql',
    )
    expect(sql).toContain('rollback notes:')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })

  // Migration 020 let anyone whose profiles.team matched work_orders.assigned_team
  // read the order's planos and cartas de empalme. That branch is the bug.
  it('drops the team branch from the work_order_documents read policy', () => {
    expect(body).toContain('drop policy if exists "tech_read_work_order_documents"')
    expect(body).toMatch(
      /create policy "tech_read_work_order_documents"[\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
    )
    // No policy this migration writes may key off the team.
    expect(body).not.toMatch(/wo\.assigned_team in \(/)
    expect(body).not.toMatch(/select team from public\.profiles/)
  })

  // Migration 039 mirrored the same team branch onto storage.objects.
  it('rescopes the work-order-documents bucket to the assignee only', () => {
    expect(body).toContain('drop policy if exists "storage_wo_docs_read"')
    expect(body).toMatch(
      /create policy "storage_wo_docs_read"[\s\S]*has_permission\('work_orders\.view'\)[\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
    )
  })

  // The big one: before this, `bucket_id = 'work-order-photos'` was the entire
  // rule for both reading and writing.
  it('closes the open read and write on the work-order-photos bucket', () => {
    expect(body).toContain('drop policy if exists "storage_photos_auth_read"')
    expect(body).toContain('drop policy if exists "storage_photos_auth_insert"')

    for (const policy of ['storage_photos_auth_read', 'storage_photos_auth_insert']) {
      const policyBody = body.split(`create policy "${policy}"`)[1]?.split('create policy')[0] ?? ''
      expect(policyBody, policy).toContain("bucket_id = 'work-order-photos'")
      expect(policyBody, policy).toContain("has_permission('work_orders.view')")
      expect(policyBody, policy).toMatch(
        /wo\.id::text = \(storage\.foldername\(name\)\)\[1\][\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
      )
    }

    // Delete stays reachable for the office and for whoever uploaded the object.
    expect(body).toMatch(/create policy "storage_photos_owner_delete"[\s\S]*auth\.uid\(\) = owner/)
    // The capture-plan example bucket (058) is out of scope: it may be named in
    // prose, but no policy here may target it.
    expect(sql).not.toMatch(/bucket_id\s*=\s*'capture-examples'/)
    expect(sql).not.toMatch(/(create|drop) policy[^\n]*capture[_-]example/)
  })

  it('adds the roster as documentation, never as an access key', () => {
    expect(sql).toContain('add column if not exists assigned_team_roster jsonb')
    const comment = sql.split('comment on column public.work_orders.assigned_team_roster is')[1] ?? ''
    expect(comment).toContain('documentación, nunca control de acceso')
    // The roster is rewritten on every assignment (a reassignment is one), so the
    // comment must not claim it is immutable — assignWorkOrder would contradict it.
    expect(comment).not.toContain('inmutable')
    expect(comment).toContain('se reescribe entera en cada asignación')
    // Prices never reach a technician or a contractor, so the roster carries none.
    expect(comment).not.toContain('price')
    expect(comment).not.toContain('unit_price')
  })

  // work_orders_technician_update is row-scoped but column-agnostic, so without a
  // trigger the documented technician can rewrite the document — is_responsible
  // included.
  it('stops the documented technician from rewriting their own roster', () => {
    expect(sql).toContain('create or replace function public.guard_assigned_team_roster()')
    expect(sql).toMatch(
      /new\.assigned_team_roster is distinct from old\.assigned_team_roster[\s\S]*has_permission\('work_orders\.edit'\)[\s\S]*raise exception/,
    )
    expect(sql).toMatch(
      /create trigger guard_assigned_team_roster\s+before update of assigned_team_roster on public\.work_orders/,
    )
    // service_role / cron / edge functions have no auth.uid() and must stay able
    // to write — the NE4 bridge upserts through that path.
    expect(sql).toContain('auth.uid() is not null and not public.has_permission')
  })

  it('requires a responsible technician wherever a team is set, without killing history', () => {
    expect(sql).toMatch(
      /add constraint work_orders_team_requires_technician[\s\S]*not valid/,
    )
    // The historical rows that violate it are reported, not silently rewritten.
    expect(sql).toContain('raise notice')
    expect(sql).toContain('work_orders de lumen con equipo y sin responsable')
  })

  // BLOCKER guard. The NE4 bridge (ne4-work-manager, edge function lumen-bridge)
  // upserts LUMEN work_orders with assigned_team and NO assigned_technician —
  // imported orders arrive already executed in rueckmeldung_sent and nobody
  // assigns them here. NOT VALID only spares rows that already exist, so an
  // unqualified CHECK would break every future sync the day 073 is applied.
  it('exempts imported orders from the check so the NE4 bridge keeps syncing', () => {
    expect(sql).toContain(
      "check (source <> 'lumen' or assigned_team is null or assigned_technician is not null)",
    )
    const comment =
      sql.split('comment on constraint work_orders_team_requires_technician')[1] ?? ''
    expect(comment).toContain('source <> lumen')
    expect(comment).toContain('ne4')
    // The cross-repo follow-up is written down where the next reader will find it.
    expect(sql).toContain('lumen-bridge')
    expect(sql).toContain('seguimiento entre repos')
  })

  // assign_work_order_checked is SECURITY DEFINER and granted to `authenticated`,
  // and 016 gave it no identity check at all. Once being the assignee is what
  // buys you the order's photos and documents, that is a file-access escalation.
  it('closes the privilege escalation in assign_work_order_checked', () => {
    expect(sql).toContain('create or replace function public.assign_work_order_checked(')
    expect(sql).toMatch(
      /perform public\.assert_work_order_rpc_permission\(\s*p_changed_by,\s*'work_orders\.assign'\s*\)/,
    )
    // The signature must stay byte-identical or 072's REVOKE/GRANT stops matching.
    expect(sql).toMatch(
      /public\.assign_work_order_checked\(\s*p_work_order_id uuid,\s*p_team public\.team_color,\s*p_assignee_id uuid,\s*p_assigned_date date,\s*p_changed_by uuid,\s*p_notes text default null\s*\)/,
    )
    expect(sql).toContain('from public, anon')
    expect(sql).toContain('to authenticated, service_role')
  })

  // A rollback note that errors when pasted is not a rollback note. Migration 020
  // ships a bare CREATE POLICY with no DROP, so "re-apply 020" does not work.
  it('documents a rollback that runs as written', () => {
    const rollback = sql.split('rollback notes')[1]?.split('begin;')[0] ?? ''
    expect(rollback).toContain('drop policy if exists "tech_read_work_order_documents"')
    expect(rollback).toContain('drop policy if exists "storage_wo_docs_read"')
    expect(rollback).toContain('drop policy if exists "storage_photos_auth_read"')
    expect(rollback).toContain('drop trigger if exists guard_assigned_team_roster')
    expect(rollback).toContain('drop constraint if exists work_orders_team_requires_technician')
    // Every CREATE it suggests must be preceded by its own DROP.
    const creates = rollback.match(/create policy "([a-z_]+)"/g) ?? []
    expect(creates.length).toBeGreaterThan(0)
    for (const create of creates) {
      const name = create.replace('create policy ', '')
      expect(rollback, name).toContain(`drop policy if exists ${name}`)
    }
  })

  // Migration 068 reads assigned_team and 072 re-declares assign_work_order_checked
  // with a p_team parameter — dropping the column would break both.
  it('keeps assigned_team alive and only changes what it means', () => {
    expect(sql).not.toMatch(/drop column[\s\S]{0,40}assigned_team\b/)
    expect(sql).not.toMatch(/rename column assigned_team/)
    expect(sql).toContain('comment on column public.work_orders.assigned_team is')
  })
})

// The idempotent hand-applied script has to describe the same live state as the
// migration; if it drifts, re-running it silently reopens the photos bucket.
describe('rls_policies.sql stays coherent with migration 073', () => {
  it('scopes the work-order-photos policies the same way the migration does', () => {
    for (const policy of ['storage_photos_auth_read', 'storage_photos_auth_insert']) {
      const body =
        rlsPoliciesSql.split(`create policy "${policy}"`)[1]?.split('create policy')[0] ?? ''
      expect(body, policy).toContain("has_permission('work_orders.view')")
      expect(body, policy).toMatch(
        /wo\.id::text = \(storage\.foldername\(name\)\)\[1\][\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
      )
    }
  })

  // Re-running the script must not trip over a policy it already created.
  it('drops every work-order-photos policy it recreates', () => {
    for (const policy of [
      'storage_photos_auth_read',
      'storage_photos_auth_insert',
      'storage_photos_owner_delete',
    ]) {
      expect(rlsPoliciesSql, policy).toContain(`drop policy if exists "${policy}"`)
    }
  })

  it('never lets a work_orders policy key off the team', () => {
    const workOrders =
      rlsPoliciesSql.split('-- work orders')[1]?.split('-- work order state history')[0] ?? ''
    expect(workOrders).toContain('assigned_technician = auth.uid()')
    expect(workOrders).not.toMatch(/using \([\s\S]*assigned_team\s*=/)
  })

  // Half a mirror is worse than none: re-running this script used to tighten the
  // photos bucket while leaving documents on the old team-wide rule, so the two
  // halves of the same fix drifted apart with nothing to say so.
  it('mirrors the document policies too, not just the photo ones', () => {
    expect(rlsPoliciesSql).toContain('drop policy if exists "tech_read_work_order_documents"')
    expect(rlsPoliciesSql).toMatch(
      /create policy "tech_read_work_order_documents"[\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
    )
    expect(rlsPoliciesSql).toContain('drop policy if exists "storage_wo_docs_read"')
    expect(rlsPoliciesSql).toMatch(
      /create policy "storage_wo_docs_read"[\s\S]*wo\.assigned_technician = auth\.uid\(\)/,
    )
    // No mirrored policy may bring the team branch back with it.
    expect(rlsPoliciesSql).not.toMatch(/select team from public\.profiles/)
    expect(rlsPoliciesSql).not.toMatch(/wo\.assigned_team in \(/)
  })

  // Migration 035's permission policies live only in that migration; dropping
  // them here would quietly cut the office off from work order documents.
  it('leaves the migration-035 permission policies alone', () => {
    // Naming them in a comment is fine — dropping or recreating them is not.
    for (const policy of ['wo_documents_select_perm', 'wo_documents_write_perm']) {
      expect(rlsPoliciesSql, policy).not.toMatch(
        new RegExp(`(drop|create) policy[^\\n]*${policy}`),
      )
    }
  })
})

// The convention that made all of this dangerous — two DDL sources, one of them
// invisible to anyone grepping `migrations/` — was nowhere in the docs.
describe('README documents the two-DDL-source trap', () => {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8').toLowerCase()

  it('warns that rls_policies.sql is a second hand-applied source', () => {
    expect(readme).toContain('rls_policies.sql')
    expect(readme).toContain('second')
    expect(readme).toMatch(/hand-applied|hand applied/)
    expect(readme).toMatch(/mirror|silently revert/)
  })
})

// Migration 068 wrote `NEW.is_direct_order` into the guard of
// validate_client_first_work_order(). That column does not exist on
// public.work_orders and never has: `is_direct_order` is form state in
// WorkOrderFormPage and persists as `client_id IS NULL` (migration 005).
// plpgsql resolves record fields when it PLANS an expression, so CREATE
// FUNCTION accepted it and every INSERT/UPDATE on work_orders failed at
// runtime with `record "new" has no field "is_direct_order"`.
describe('migration 074 removes the phantom column from the routing trigger', () => {
  const raw = readRequiredMigration('074_fix_validate_client_first_phantom_column.sql')
  const sql = raw.toLowerCase()
  const body = sql.slice(sql.indexOf('\nbegin;'))

  it('declares its place in the sequence', () => {
    expect(raw).toContain('-- Depends on: 073_work_order_access_scope.sql')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })

  it('replaces the function without ever naming the phantom column', () => {
    expect(body).toContain('create or replace function public.validate_client_first_work_order()')
    expect(body).not.toContain('is_direct_order')
  })

  it('keeps the guard checking client_id, which is what direct-order really means', () => {
    expect(body).toMatch(
      /if\s+tg_op\s*=\s*'update'[\s\S]*new\.client_id\s+is\s+not\s+distinct\s+from\s+old\.client_id[\s\S]*return\s+new/,
    )
  })

  // The rest of the body must be migration 068's, character for character.
  // Anything else in this diff is an unreviewed behaviour change riding along
  // with a hotfix.
  it('changes nothing else in the function', () => {
    const fnOf = (text: string) => {
      const start = text.indexOf('CREATE OR REPLACE FUNCTION public.validate_client_first_work_order()')
      return text.slice(start, text.indexOf('\n$$;', start))
    }
    const original = fnOf(readRequiredMigration('068_client_first_work_order_routing.sql'))
    const fixed = fnOf(raw)
    const dropped = original
      .split('\n')
      .filter((l) => !fixed.split('\n').includes(l))
      .map((l) => l.trim())
    expect(dropped).toEqual(['AND NEW.is_direct_order IS NOT DISTINCT FROM OLD.is_direct_order'])
  })
})
