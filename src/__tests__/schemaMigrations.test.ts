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
})
