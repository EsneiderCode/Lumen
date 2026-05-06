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

describe('database migrations cover billing workflow schema', () => {
  it('allows direct orders without a client', () => {
    expect(migrationSql).toMatch(/alter\s+table\s+(public\.)?work_orders[\s\S]*alter\s+column\s+client_id\s+drop\s+not\s+null/)
  })

  it('adds external pricing to service items', () => {
    expect(migrationSql).toMatch(/alter\s+table\s+(public\.)?service_items[\s\S]*add\s+column\s+if\s+not\s+exists\s+unit_price_external/)
  })

  it('creates billing lines with price snapshots', () => {
    expect(migrationSql).toContain('create table if not exists public.work_order_billing_lines')
    expect(migrationSql).toContain('unit_price_snapshot')
    expect(migrationSql).toContain('unit_price_external_snapshot')
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
})
