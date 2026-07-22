/**
 * Demo-mode fixture data — seeded into the in-memory store on first load
 * and on every `demo:reset`. Designed to exercise every screen of the app.
 *
 * This is NOT real production data. All UUIDs are stable so links survive reload.
 */

import { MODULE_REGISTRY } from '@/config/permissions'

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const TECH_ID = '00000000-0000-0000-0000-000000000002'
const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
const SCHEDULER_ID = '00000000-0000-0000-0000-000000000004'

const CLIENT_INSYTE = '10000000-0000-0000-0000-000000000001'
const CLIENT_VANCOM = '10000000-0000-0000-0000-000000000002'

const PROJECT_HXT = '20000000-0000-0000-0000-000000000001'
const PROJECT_RSD = '20000000-0000-0000-0000-000000000002'
const PROJECT_WCB = '20000000-0000-0000-0000-000000000003'

const OP_DGF = '30000000-0000-0000-0000-000000000001'
const OP_GFPLUS = '30000000-0000-0000-0000-000000000002'
const OP_UGG = '30000000-0000-0000-0000-000000000003'

const SI_SOPLADO_M = '40000000-0000-0000-0000-000000000001'
const SI_FUSION_AP = '40000000-0000-0000-0000-000000000002'
const SI_ALTA_BASIC = '40000000-0000-0000-0000-000000000003'
const SI_ALTA_NT = '40000000-0000-0000-0000-000000000004'
const SI_PATCHKABEL = '40000000-0000-0000-0000-000000000005'
const SI_NAS_PAKET_1 = '40000000-0000-0000-0000-000000000006'
const SI_WESTC_130 = '40000000-0000-0000-0000-000000000007'
const SI_VANCOM_160 = '40000000-0000-0000-0000-000000000008'

const VEHICLE_ROT_COMBO = '41000000-0000-0000-0000-000000000001'
const MAT_GFP_HUEP_48 = '42000000-0000-0000-0000-000000000001'
const MAT_GFP_HUEP_1 = '42000000-0000-0000-0000-000000000002'
const MAT_GFP_PIGTAIL = '42000000-0000-0000-0000-000000000003'
const MAT_GFP_PATCH_45 = '42000000-0000-0000-0000-000000000004'

const WO_1 = '50000000-0000-0000-0000-000000000001'
const WO_2 = '50000000-0000-0000-0000-000000000002'
const WO_3 = '50000000-0000-0000-0000-000000000003'
const WO_4_DIRECT = '50000000-0000-0000-0000-000000000004'
const WO_5_PAID = '50000000-0000-0000-0000-000000000005'
const WO_6_REJECTED = '50000000-0000-0000-0000-000000000006'
const WO_7_EXTERNAL = '50000000-0000-0000-0000-000000000007'
const WO_8_NE4 = '50000000-0000-0000-0000-000000000008'
const WO_9_DIRECT_TECH = '50000000-0000-0000-0000-000000000009'

const APPT_1 = '70000000-0000-0000-0000-000000000001'
const APPT_2 = '70000000-0000-0000-0000-000000000002'
const APPT_3 = '70000000-0000-0000-0000-000000000003'
const APPT_4 = '70000000-0000-0000-0000-000000000004'

const EMPLOYEE_TECH = '60000000-0000-0000-0000-000000000001'
const EMPLOYEE_OFFICE = '60000000-0000-0000-0000-000000000002'

const NOW = new Date('2026-04-28T08:00:00Z').toISOString()
const YESTERDAY = new Date('2026-04-27T08:00:00Z').toISOString()
const LAST_WEEK = new Date('2026-04-21T08:00:00Z').toISOString()

// ── RBAC (migration 034) ─────────────────────────────────────────────────────
const ROLE_ADMIN = '90000000-0000-0000-0000-000000000001'
const ROLE_TECHNICIAN = '90000000-0000-0000-0000-000000000002'
const ROLE_CONTRACTOR = '90000000-0000-0000-0000-000000000003'
const ROLE_SCHEDULER = '90000000-0000-0000-0000-000000000004'
const ROLE_SUPERVISOR = '90000000-0000-0000-0000-000000000010'

export const SYSTEM_ROLE_IDS: Record<string, string> = {
  admin: ROLE_ADMIN,
  technician: ROLE_TECHNICIAN,
  contractor: ROLE_CONTRACTOR,
  scheduler: ROLE_SCHEDULER,
}

// Permission ids are derived from the key so they stay stable across reloads.
export const demoPermissionId = (key: string) => `permission-${key}`

const DEMO_PERMISSIONS = MODULE_REGISTRY.flatMap((entry) =>
  entry.actions.map((action) => ({
    id: demoPermissionId(`${entry.module}.${action}`),
    module: entry.module as string,
    action: action as string,
    description: null as string | null,
    key: `${entry.module}.${action}`,
    created_at: LAST_WEEK,
  })),
)

const DEMO_ROLE_PERMISSIONS = [
  // admin → everything (mirrors the migration seed)
  ...DEMO_PERMISSIONS.map((permission) => ({
    role_id: ROLE_ADMIN,
    permission_id: permission.id,
    created_at: LAST_WEEK,
  })),
  // field/scheduler personas → portal access only
  { role_id: ROLE_TECHNICIAN, permission_id: demoPermissionId('portal.tech.access'), created_at: LAST_WEEK },
  { role_id: ROLE_CONTRACTOR, permission_id: demoPermissionId('portal.contractor.access'), created_at: LAST_WEEK },
  { role_id: ROLE_SCHEDULER, permission_id: demoPermissionId('portal.scheduler.access'), created_at: LAST_WEEK },
  // sample custom role: read-only operations supervisor
  ...['portal.admin.access', 'dashboard.view', 'work_orders.view', 'work_orders.export', 'certification.view'].map(
    (key) => ({ role_id: ROLE_SUPERVISOR, permission_id: demoPermissionId(key), created_at: LAST_WEEK }),
  ),
]

export const DEMO_PASSWORD = 'demo123'
export const DEMO_TECH_PIN = '1234'

export interface DemoSession {
  user: { id: string; email: string } | null
  access_token: string | null
}

export const initialFixtures = () => ({
  profiles: [
    {
      id: ADMIN_ID,
      email: 'admin@demo.lumen',
      full_name: 'Demo Admin',
      role: 'admin',
      team: null,
      pin_login_code: null,
      pin_set_at: null,
      last_pin_login_at: null,
      is_active: true,
      scheduler_line: null,
      scheduler_operator: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: TECH_ID,
      email: 'tech@demo.lumen',
      full_name: 'Demo Técnico',
      role: 'technician',
      team: 'rot',
      pin_login_code: 'tech-demo',
      pin_set_at: LAST_WEEK,
      last_pin_login_at: null,
      is_active: true,
      scheduler_line: null,
      scheduler_operator: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: CONTRACTOR_ID,
      email: 'contractor@demo.lumen',
      full_name: 'Demo Contractor',
      role: 'contractor',
      team: 'blau',
      pin_login_code: 'contractor-demo',
      pin_set_at: LAST_WEEK,
      last_pin_login_at: null,
      is_active: true,
      scheduler_line: null,
      scheduler_operator: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: SCHEDULER_ID,
      email: 'beatriz@demo.lumen',
      full_name: 'Beatriz Sandoval',
      role: 'scheduler',
      team: null,
      pin_login_code: null,
      pin_set_at: null,
      last_pin_login_at: null,
      is_active: true,
      scheduler_line: 'NE3',
      scheduler_operator: OP_DGF,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ] as Array<{
    id: string
    email: string | null
    full_name: string
    role: string
    team: string | null
    pin_login_code: string | null
    pin_set_at: string | null
    last_pin_login_at: string | null
    is_active: boolean
    scheduler_line: string | null
    scheduler_operator: string | null
    created_at: string
    updated_at: string
  }>,

  employees: [
    {
      id: EMPLOYEE_TECH,
      full_name: 'Demo Técnico',
      email: 'tech@demo.lumen',
      phone: '+49 170 0000002',
      sv_nummer: '12 345678 T 002',
      steuer_id: '12 345 678 902',
      steuerklasse: 'I',
      iban: 'DE89370400440532013002',
      gross_salary: 3200,
      start_date: '2026-01-01',
      end_date: null,
      notes: 'Demo: field technician linked to app profile',
      team: 'rot',
      profile_id: TECH_ID,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: EMPLOYEE_OFFICE,
      full_name: 'Mara Backoffice',
      email: 'office@demo.lumen',
      phone: '+49 170 0000004',
      sv_nummer: '12 345678 O 004',
      steuer_id: '12 345 678 904',
      steuerklasse: 'IV',
      iban: 'DE89370400440532013004',
      gross_salary: 2850,
      start_date: '2026-02-01',
      end_date: null,
      notes: 'Demo: office staff without field team',
      team: null,
      profile_id: null,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ],

  vacation_requests: [],

  clients: [
    { id: CLIENT_INSYTE, name: 'Insyte Deutschland', code: 'INSYTE', is_active: true, created_at: LAST_WEEK },
    { id: CLIENT_VANCOM, name: 'Vancom IT',         code: 'VANCOM', is_active: true, created_at: LAST_WEEK },
  ],

  projects: [
    {
      id: PROJECT_HXT, code: 'HXT', name: 'Höxter Nord', client_id: CLIENT_INSYTE,
      default_operator_id: OP_DGF, default_line: 'NE3', is_active: true, created_at: LAST_WEEK,
    },
    {
      id: PROJECT_RSD, code: 'RSD', name: 'Roßdorf 1', client_id: CLIENT_INSYTE,
      default_operator_id: OP_DGF, default_line: 'NE3', is_active: true, created_at: LAST_WEEK,
    },
    {
      id: PROJECT_WCB, code: 'WCB', name: 'Westconnect', client_id: CLIENT_VANCOM,
      default_operator_id: OP_GFPLUS, default_line: 'NE4', is_active: true, created_at: LAST_WEEK,
    },
  ],

  operators: [
    { id: OP_DGF,    code: 'DGF',    name: 'Deutsche Glasfaser', is_active: true, created_at: LAST_WEEK },
    { id: OP_GFPLUS, code: 'GFPLUS', name: 'GlasfaserPlus',      is_active: true, created_at: LAST_WEEK },
    { id: OP_UGG,    code: 'UGG',    name: 'UGG',                is_active: true, created_at: LAST_WEEK },
  ],

  service_items: [
    {
      id: SI_SOPLADO_M, code: 'SOP-M', description_de: 'Einblasen Glasfaser je Meter',
      description_es: 'Soplado por metro', unit: 'm', unit_price: 1.85, unit_price_external: 1.20,
      category: 'NE3 > Infraestructura',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'soplado',
      display_order: 10, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FUSION_AP, code: 'FUS-AP', description_de: 'Spleißung am AP (pro Schrank)',
      description_es: 'Fusión AP por armario', unit: 'Stk', unit_price: 95.00, unit_price_external: 60.00,
      category: 'NE3 > Infraestructura',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'fusion_ap',
      display_order: 20, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_ALTA_BASIC, code: 'ALTA-BASIC', description_de: 'Standard-Hausanschluss',
      description_es: 'Alta básica', unit: 'Stk', unit_price: 145.00, unit_price_external: 95.00,
      category: 'NE4 > Altas cliente Deutsche Glasfaser / UGG',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'alta',
      display_order: 30, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_ALTA_NT, code: 'ALTA-NT', description_de: 'NT-Installation und Aktivierung',
      description_es: 'Instalación NT', unit: 'Stk', unit_price: 65.00, unit_price_external: 40.00,
      category: 'NE4 > Altas cliente Deutsche Glasfaser / UGG',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'nt',
      display_order: 31, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_PATCHKABEL, code: 'PATCH', description_de: 'Patchkabel Anschluss',
      description_es: 'Patchkabel', unit: 'Stk', unit_price: 38.00, unit_price_external: 22.00,
      category: 'NE4 > ONT / Aktivierung',
      operator_id: OP_GFPLUS, client_id: CLIENT_VANCOM, detail_form: 'patchkabel',
      display_order: 40, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_NAS_PAKET_1, code: 'NAS Paket 1', description_de: 'ACT_001 + HBG + GB + Termin + OTDR',
      description_es: null, unit: 'Psch.', unit_price: 589.80, unit_price_external: 400.00,
      category: 'NE4 > Hausanschluss / NAS / acometida cliente',
      operator_id: OP_DGF, client_id: null, detail_form: 'alta',
      display_order: 215, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_WESTC_130, code: 'WESTC_MDU_130', description_de: 'Mehraufwand Raumhöhe über 2,65 m',
      description_es: null, unit: 'Stück', unit_price: 21.00, unit_price_external: 15.00,
      category: 'NE4 > Suplementos / Mehraufwand',
      operator_id: null, client_id: null, detail_form: null,
      display_order: 500, active: true, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_VANCOM_160, code: 'Vancom 160', description_de: 'Denkmalschutz',
      description_es: null, unit: 'Stk', unit_price: null, unit_price_external: null,
      category: 'NE4 > Suplementos / Mehraufwand',
      operator_id: null, client_id: CLIENT_VANCOM, detail_form: null,
      display_order: 540, active: true, notes: 'Precio según oferta', created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
  ],

  materials: [
    {
      id: MAT_GFP_HUEP_48,
      name: 'GF-AP HÜP 4-8 WE GFP',
      category: 'Activacion',
      sku: 'GFM000453',
      catalog_client_id: CLIENT_VANCOM,
      catalog_source: 'gfp',
      unit: 'ud',
      min_stock: 2,
      notes: 'AP 4-8 Cajas lunas para splitter',
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: MAT_GFP_HUEP_1,
      name: 'GF-AP HÜP 1 WE GFP',
      category: 'Activacion',
      sku: 'GFM000454',
      catalog_client_id: CLIENT_VANCOM,
      catalog_source: 'gfp',
      unit: 'ud',
      min_stock: 2,
      notes: null,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: MAT_GFP_PIGTAIL,
      name: 'Gf-TA mit Pigtail und Spleißablage',
      category: 'Activacion',
      sku: 'GFM000535',
      catalog_client_id: CLIENT_VANCOM,
      catalog_source: 'westconnect',
      unit: 'ud',
      min_stock: 4,
      notes: 'FTTH-ANSCHLUSSDOSE AP MIT SPLEIßABL. EON',
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: MAT_GFP_PATCH_45,
      name: 'PATCHKABEL G657A1 4,5M LCAPC-LCAPC 1,6MM',
      category: 'Latiguillos',
      sku: 'GFM000360',
      catalog_client_id: CLIENT_VANCOM,
      catalog_source: 'gfp',
      unit: 'ud',
      min_stock: 5,
      notes: null,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ],

  inventory_vehicles: [
    {
      id: VEHICLE_ROT_COMBO,
      name: 'Rot-Opel Combo',
      team: 'rot',
      license_plate: null,
      notes: 'Demo: vehículo principal del equipo Rot',
      active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ],

  vehicle_material_stock: [
    { id: '43000000-0000-0000-0000-000000000001', vehicle_id: VEHICLE_ROT_COMBO, material_id: MAT_GFP_HUEP_48, quantity: 8, updated_at: LAST_WEEK },
    { id: '43000000-0000-0000-0000-000000000002', vehicle_id: VEHICLE_ROT_COMBO, material_id: MAT_GFP_HUEP_1, quantity: 5, updated_at: LAST_WEEK },
    { id: '43000000-0000-0000-0000-000000000003', vehicle_id: VEHICLE_ROT_COMBO, material_id: MAT_GFP_PIGTAIL, quantity: 12, updated_at: LAST_WEEK },
    { id: '43000000-0000-0000-0000-000000000004', vehicle_id: VEHICLE_ROT_COMBO, material_id: MAT_GFP_PATCH_45, quantity: 3, updated_at: LAST_WEEK },
  ],

  work_orders: [
    // 1 — created, just opened
    {
      id: WO_1, order_number: 'LUM-20260428-0001',
      client_id: CLIENT_INSYTE, project_id: PROJECT_HXT, operator_id: OP_DGF,
      line: 'NE3', work_type: 'soplado', status: 'created', priority: 'normal',
      assigned_team: null, assigned_technician: null, assigned_date: null,
      address: 'Bahnhofstraße 12', postal_code: '37671', city: 'Höxter',
      internal_notes: 'Demo: soplado nuevo, sin asignar', assigned_detail_snapshot: null,
      service_item_id: SI_SOPLADO_M, created_by: ADMIN_ID,
      created_at: NOW, updated_at: NOW,
    },
    // 2 — assigned to técnico, in progress
    {
      id: WO_2, order_number: 'LUM-20260428-0002',
      client_id: CLIENT_INSYTE, project_id: PROJECT_RSD, operator_id: OP_DGF,
      line: 'NE4', work_type: 'fusion_ap', status: 'in_progress', priority: 'alta',
      assigned_team: 'rot', assigned_technician: TECH_ID, assigned_date: '2026-04-28',
      address: 'Kirchplatz 5', postal_code: '64380', city: 'Roßdorf',
      internal_notes: 'Demo: fusión AP en curso', assigned_detail_snapshot: { cabinet_code: 'NE4-S-007' },
      service_item_id: SI_FUSION_AP, created_by: ADMIN_ID,
      created_at: YESTERDAY, updated_at: NOW,
    },
    // 3 — Rückmeldung sent, awaiting internal cert
    {
      id: WO_3, order_number: 'LUM-20260427-0003',
      client_id: CLIENT_INSYTE, project_id: PROJECT_HXT, operator_id: OP_DGF,
      line: 'NE3', work_type: 'alta', status: 'rueckmeldung_sent', priority: 'normal',
      assigned_team: 'rot', assigned_technician: TECH_ID, assigned_date: '2026-04-27',
      address: 'Hauptstraße 88', postal_code: '37671', city: 'Höxter',
      internal_notes: null, assigned_detail_snapshot: null,
      service_item_id: SI_ALTA_BASIC, created_by: ADMIN_ID,
      created_at: YESTERDAY, updated_at: NOW,
    },
    // 4 — DIRECT order, ready to invoice
    {
      id: WO_4_DIRECT, order_number: 'LUM-20260426-0004',
      client_id: null, project_id: PROJECT_HXT, operator_id: OP_UGG,
      line: 'NE3', work_type: 'patchkabel', status: 'internally_certified', priority: 'normal',
      assigned_team: 'gruen', assigned_technician: TECH_ID, assigned_date: '2026-04-26',
      address: 'Marktplatz 1', postal_code: '37671', city: 'Höxter',
      internal_notes: 'Demo: orden directa sin cliente externo', assigned_detail_snapshot: null,
      service_item_id: SI_PATCHKABEL, created_by: ADMIN_ID,
      created_at: LAST_WEEK, updated_at: NOW,
    },
    // 5 — paid (full pipeline)
    {
      id: WO_5_PAID, order_number: 'LUM-20260421-0005',
      client_id: CLIENT_VANCOM, project_id: PROJECT_WCB, operator_id: OP_GFPLUS,
      line: 'NE4', work_type: 'fusion_ap', status: 'paid', priority: 'normal',
      assigned_team: 'blau', assigned_technician: TECH_ID, assigned_date: '2026-04-21',
      address: 'Industriestraße 4', postal_code: '70567', city: 'Stuttgart',
      internal_notes: 'Demo: cerrada y pagada', assigned_detail_snapshot: { cabinet_code: 'NE4-S-001' },
      service_item_id: SI_FUSION_AP, created_by: ADMIN_ID,
      created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    // 6 — client_rejected, returns to revision
    {
      id: WO_6_REJECTED, order_number: 'LUM-20260427-0006',
      client_id: CLIENT_INSYTE, project_id: PROJECT_RSD, operator_id: OP_DGF,
      line: 'NE3', work_type: 'soplado', status: 'client_rejected', priority: 'urgente',
      assigned_team: 'rot', assigned_technician: TECH_ID, assigned_date: '2026-04-27',
      address: 'Schulstraße 3', postal_code: '64380', city: 'Roßdorf',
      internal_notes: 'Demo: rechazada por cliente, motivo en notes', assigned_detail_snapshot: null,
      service_item_id: SI_SOPLADO_M, created_by: ADMIN_ID,
      created_at: YESTERDAY, updated_at: NOW,
    },
    // 7 — EXTERNAL collaborator: assigned to contractor, ready for client cert + external cert
    {
      id: WO_7_EXTERNAL, order_number: 'LUM-20260425-0007',
      client_id: CLIENT_INSYTE, project_id: PROJECT_HXT, operator_id: OP_DGF,
      line: 'NE3', work_type: 'alta', status: 'internally_certified', priority: 'normal',
      assigned_team: 'gelb', assigned_technician: CONTRACTOR_ID, assigned_date: '2026-04-25',
      address: 'Lindenstraße 22', postal_code: '37671', city: 'Höxter',
      internal_notes: 'Demo: orden con colaborador externo (contractor) — billing dual',
      assigned_detail_snapshot: null,
      service_item_id: SI_ALTA_BASIC, created_by: ADMIN_ID,
      created_at: LAST_WEEK, updated_at: NOW,
    },
    // 8 — NE4 bridge: synced from NE4 Work Manager, awaiting internal certification
    {
      id: WO_8_NE4, order_number: 'NE4-demo-0001',
      client_id: CLIENT_INSYTE, project_id: PROJECT_WCB, operator_id: OP_GFPLUS,
      line: 'NE4', work_type: 'alta', status: 'rueckmeldung_sent', priority: 'normal',
      assigned_team: null, assigned_technician: null, assigned_date: '2026-04-21',
      address: 'Westfalenstraße 7', postal_code: '44141', city: 'Dortmund',
      internal_notes: 'Synced from NE4 Work Manager\nNE4 report: a1b2c3d4-0000-0000-0000-000000000001\nNE4 cita: c5d6e7f8-0000-0000-0000-000000000002\nHA: HA-2024-5501\nWE: 4\nWorkflow: ALTA_STANDARD\nInstallation type: Tiefbau\nWork zones: Zone-A, Zone-B\nScore: 5',
      source: 'ne4',
      external_metadata: {
        system: 'ne4-work-manager',
        report_id: 'a1b2c3d4-0000-0000-0000-000000000001',
        cita_id: 'c5d6e7f8-0000-0000-0000-000000000002',
        ha: 'HA-2024-5501',
        we_count: 4,
        workflow_code: 'ALTA_STANDARD',
        installation_type: 'Tiefbau',
        work_zones: ['Zone-A', 'Zone-B'],
        score: 5,
        submitted_at: LAST_WEEK,
        contact_name: 'Hans Müller',
        contact_phone: '+49 231 555 0101',
      },
      assigned_detail_snapshot: null,
      service_item_id: SI_ALTA_BASIC, created_by: ADMIN_ID,
      created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    // 9 — direct-to-technician assignment: no team, only assigned_technician
    {
      id: WO_9_DIRECT_TECH, order_number: 'LUM-20260428-0009',
      client_id: CLIENT_INSYTE, project_id: PROJECT_HXT, operator_id: OP_DGF,
      line: 'NE3', work_type: 'nt_installation', status: 'assigned', priority: 'normal',
      assigned_team: null, assigned_technician: TECH_ID, assigned_date: '2026-04-29',
      address: 'Gartenweg 9', postal_code: '37671', city: 'Höxter',
      internal_notes: 'Demo: asignada directamente a un técnico, sin equipo',
      assigned_detail_snapshot: null,
      service_item_id: SI_ALTA_NT, created_by: ADMIN_ID,
      created_at: NOW, updated_at: NOW,
    },
  ],

  appointments: [
    // Within Beatriz's scope (NE3 + DGF) — visible to her
    {
      id: APPT_1, work_order_id: WO_1, line: 'NE3', operator_id: OP_DGF,
      scheduled_at: new Date('2026-05-02T09:00:00Z').toISOString(), duration_min: 60,
      address: 'Bahnhofstraße 12, 37671 Höxter', contact_name: 'Klaus Berger', contact_phone: '+49 170 1111001',
      status: 'proposed', notes: 'Demo: cita propuesta, pendiente de confirmar',
      assigned_to: SCHEDULER_ID, created_by: SCHEDULER_ID, created_at: NOW, updated_at: NOW,
    },
    {
      id: APPT_2, work_order_id: WO_3, line: 'NE3', operator_id: OP_DGF,
      scheduled_at: new Date('2026-05-03T11:30:00Z').toISOString(), duration_min: 90,
      address: 'Hauptstraße 88, 37671 Höxter', contact_name: 'Renate Vogel', contact_phone: '+49 170 1111002',
      status: 'confirmed', notes: 'Demo: confirmada con el cliente',
      assigned_to: SCHEDULER_ID, created_by: SCHEDULER_ID, created_at: YESTERDAY, updated_at: NOW,
    },
    {
      id: APPT_3, work_order_id: null, line: 'NE3', operator_id: OP_DGF,
      scheduled_at: new Date('2026-04-30T14:00:00Z').toISOString(), duration_min: 60,
      address: 'Schulstraße 3, 64380 Roßdorf', contact_name: 'Markus Lange', contact_phone: '+49 170 1111003',
      status: 'completed', notes: 'Demo: cita cerrada sin orden vinculada',
      assigned_to: SCHEDULER_ID, created_by: SCHEDULER_ID, created_at: LAST_WEEK, updated_at: YESTERDAY,
    },
    {
      id: APPT_4, work_order_id: null, line: 'NE3', operator_id: OP_DGF,
      scheduled_at: new Date('2026-05-05T08:00:00Z').toISOString(), duration_min: 60,
      address: 'Lindenstraße 22, 37671 Höxter', contact_name: 'Sabine Roth', contact_phone: '+49 170 1111004',
      status: 'rescheduled', notes: 'Demo: reagendada a petición del cliente',
      assigned_to: SCHEDULER_ID, created_by: SCHEDULER_ID, created_at: LAST_WEEK, updated_at: NOW,
    },
    // Out of scope (NE4 / different operator) — must NOT appear for Beatriz
    {
      id: '70000000-0000-0000-0000-000000000099', work_order_id: WO_5_PAID, line: 'NE4', operator_id: OP_GFPLUS,
      scheduled_at: new Date('2026-05-04T10:00:00Z').toISOString(), duration_min: 60,
      address: 'Industriestraße 4, 70567 Stuttgart', contact_name: 'Out Of Scope', contact_phone: '+49 170 9999999',
      status: 'proposed', notes: 'Demo: fuera del scope de Beatriz (NE4/GFPLUS)',
      assigned_to: null, created_by: ADMIN_ID, created_at: NOW, updated_at: NOW,
    },
  ],

  wo_detail_soplado: [
    { id: 'd1000000-0000-0000-0000-000000000001', work_order_id: WO_3, meters: 142.5, section: 'AP-37 → DP-12', tube_diameter: '40/33', result: 'OK', created_at: NOW },
    { id: 'd1000000-0000-0000-0000-000000000005', work_order_id: WO_5_PAID, meters: 95, section: 'POP-2 → AP-1', tube_diameter: '32/26', result: 'OK', created_at: LAST_WEEK },
  ],

  wo_detail_fusion_ap: [
    { id: 'd2000000-0000-0000-0000-000000000002', work_order_id: WO_2, splice_count: 24, fiber_type: 'G.652D', fusion_losses: 0.08, has_measurement_cert: false, cabinet_code: 'NE4-S-007', card_count: null, created_at: NOW },
    { id: 'd2000000-0000-0000-0000-000000000005', work_order_id: WO_5_PAID, splice_count: 16, fiber_type: 'G.657A1', fusion_losses: 0.05, has_measurement_cert: true, cabinet_code: 'NE4-S-001', card_count: null, created_at: LAST_WEEK },
  ],

  wo_detail_fusion_dp: [],

  wo_detail_alta: [
    { id: 'd3000000-0000-0000-0000-000000000003', work_order_id: WO_3, access_type: 'Tiefbau', equipment_installed: 'NT-1234, ONT-5678', client_signature: true, reported_service_items: [], created_at: NOW },
    { id: 'd3000000-0000-0000-0000-000000000007', work_order_id: WO_7_EXTERNAL, access_type: 'Hausanschluss', equipment_installed: 'NT-9001, ONT-7700, Patchkabel 5m', client_signature: true, reported_service_items: [
      { service_item_id: SI_ALTA_BASIC, qty: 1, notes: null },
      { service_item_id: SI_ALTA_NT, qty: 1, notes: null },
      { service_item_id: SI_PATCHKABEL, qty: 1, notes: null },
    ], created_at: LAST_WEEK },
  ],

  wo_detail_nt: [],

  wo_detail_patchkabel: [
    { id: 'd4000000-0000-0000-0000-000000000004', work_order_id: WO_4_DIRECT, connected_section: 'POP→Rack-3', cable_length: 2.5, connector_type: 'LC/APC', test_result: 'OK', created_at: LAST_WEEK },
  ],

  work_order_photos: [
    { id: 'p0000000-0000-0000-0000-000000000031', work_order_id: WO_3, storage_path: 'demo/wo3-before.jpg', photo_type: 'before',  caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000032', work_order_id: WO_3, storage_path: 'demo/wo3-during.jpg', photo_type: 'during',  caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000033', work_order_id: WO_3, storage_path: 'demo/wo3-after.jpg',  photo_type: 'after',   caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000041', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-before.jpg', photo_type: 'before', caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000042', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-during.jpg', photo_type: 'during', caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000043', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-after.jpg',  photo_type: 'after',  caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000051', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-before.jpg', photo_type: 'before', caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000052', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-during.jpg', photo_type: 'during', caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000053', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-after.jpg',  photo_type: 'after',  caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000071', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-before.jpg', photo_type: 'before', caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000072', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-during.jpg', photo_type: 'during', caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000073', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-after.jpg',  photo_type: 'after',  caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
  ],

  work_order_state_history: [
    { id: 'h0000000-0000-0000-0000-000000000010', work_order_id: WO_1, from_status: null,                    to_status: 'created',              changed_by: ADMIN_ID, notes: 'Auftrag erstellt', created_at: NOW },
    { id: 'h0000000-0000-0000-0000-000000000020', work_order_id: WO_2, from_status: null,                    to_status: 'created',              changed_by: ADMIN_ID, notes: 'Auftrag erstellt', created_at: YESTERDAY },
    { id: 'h0000000-0000-0000-0000-000000000021', work_order_id: WO_2, from_status: 'created',               to_status: 'assigned',             changed_by: ADMIN_ID, notes: 'Zugewiesen an Team rot', created_at: YESTERDAY },
    { id: 'h0000000-0000-0000-0000-000000000022', work_order_id: WO_2, from_status: 'assigned',              to_status: 'in_progress',          changed_by: TECH_ID,  notes: null, created_at: NOW },
    { id: 'h0000000-0000-0000-0000-000000000040', work_order_id: WO_4_DIRECT, from_status: null,             to_status: 'created',              changed_by: ADMIN_ID, notes: 'Direktauftrag', created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000041', work_order_id: WO_4_DIRECT, from_status: 'created',        to_status: 'assigned',             changed_by: ADMIN_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000042', work_order_id: WO_4_DIRECT, from_status: 'assigned',       to_status: 'in_progress',          changed_by: TECH_ID,  notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000043', work_order_id: WO_4_DIRECT, from_status: 'in_progress',    to_status: 'executed',             changed_by: TECH_ID,  notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000044', work_order_id: WO_4_DIRECT, from_status: 'executed',       to_status: 'rueckmeldung_pending', changed_by: TECH_ID,  notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000045', work_order_id: WO_4_DIRECT, from_status: 'rueckmeldung_pending', to_status: 'rueckmeldung_sent', changed_by: TECH_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000046', work_order_id: WO_4_DIRECT, from_status: 'rueckmeldung_sent',    to_status: 'internally_certified', changed_by: ADMIN_ID, notes: 'Hash: a1b2c3...', created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000070', work_order_id: WO_7_EXTERNAL, from_status: null,                    to_status: 'created',              changed_by: ADMIN_ID, notes: 'Auftrag erstellt — Subkontrato', created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000071', work_order_id: WO_7_EXTERNAL, from_status: 'created',               to_status: 'assigned',             changed_by: ADMIN_ID, notes: 'Zugewiesen an externen Mitarbeiter', created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000072', work_order_id: WO_7_EXTERNAL, from_status: 'assigned',              to_status: 'in_progress',          changed_by: CONTRACTOR_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000073', work_order_id: WO_7_EXTERNAL, from_status: 'in_progress',           to_status: 'executed',             changed_by: CONTRACTOR_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000074', work_order_id: WO_7_EXTERNAL, from_status: 'executed',              to_status: 'rueckmeldung_pending', changed_by: CONTRACTOR_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000075', work_order_id: WO_7_EXTERNAL, from_status: 'rueckmeldung_pending',  to_status: 'rueckmeldung_sent',    changed_by: CONTRACTOR_ID, notes: null, created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000076', work_order_id: WO_7_EXTERNAL, from_status: 'rueckmeldung_sent',     to_status: 'internally_certified', changed_by: ADMIN_ID, notes: 'Hash: f7e6d5...', created_at: LAST_WEEK },
    { id: 'h0000000-0000-0000-0000-000000000080', work_order_id: WO_8_NE4, from_status: null,               to_status: 'rueckmeldung_sent', changed_by: ADMIN_ID, notes: 'Auto-synced from NE4 Work Manager', created_at: LAST_WEEK },
  ],

  certification_audits: [
    { id: 'a0000000-0000-0000-0000-000000000040', work_order_id: WO_4_DIRECT, cert_type: 'internal', certified_by: ADMIN_ID, certified_at: LAST_WEEK, data_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef123456', notes: 'Demo cert', created_at: LAST_WEEK },
    { id: 'a0000000-0000-0000-0000-000000000050', work_order_id: WO_5_PAID,   cert_type: 'internal', certified_by: ADMIN_ID, certified_at: LAST_WEEK, data_hash: 'b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef1234567a', notes: null, created_at: LAST_WEEK },
    { id: 'a0000000-0000-0000-0000-000000000051', work_order_id: WO_5_PAID,   cert_type: 'client',   certified_by: ADMIN_ID, certified_at: LAST_WEEK, data_hash: 'c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef1234567ab2', notes: 'Vancom akzeptiert', created_at: LAST_WEEK },
    { id: 'a0000000-0000-0000-0000-000000000070', work_order_id: WO_7_EXTERNAL, cert_type: 'internal', certified_by: ADMIN_ID, certified_at: LAST_WEEK, data_hash: 'f7e6d5c4b3a29180716253647586970a1b2c3d4e5f60a1b2c3d4e5f607182930', notes: 'Demo: cert interna lista, falta cert cliente y cert externo', created_at: LAST_WEEK },
  ],

  work_order_billing_lines: [
    // Alta multi-item example for WO_7_EXTERNAL
    { id: 'l0000000-0000-0000-0000-000000000071', work_order_id: WO_7_EXTERNAL, service_item_id: SI_ALTA_BASIC, qty: 1, unit_price_snapshot: 145.00,         unit_price_external_snapshot: 95.00, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'l0000000-0000-0000-0000-000000000072', work_order_id: WO_7_EXTERNAL, service_item_id: SI_ALTA_NT,    qty: 1, unit_price_snapshot: 65.00,          unit_price_external_snapshot: 40.00, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'l0000000-0000-0000-0000-000000000073', work_order_id: WO_7_EXTERNAL, service_item_id: SI_PATCHKABEL, qty: 1, unit_price_snapshot: 38.00,          unit_price_external_snapshot: 22.00, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  work_order_material_consumptions: [],

  stock_movements: [
    {
      id: '44000000-0000-0000-0000-000000000001',
      vehicle_id: VEHICLE_ROT_COMBO,
      material_id: MAT_GFP_HUEP_48,
      work_order_id: null,
      movement_type: 'import',
      quantity_delta: 8,
      stock_before: 0,
      stock_after: 8,
      reason: 'Demo seed GFP',
      created_by: ADMIN_ID,
      created_at: LAST_WEEK,
    },
  ],

  contractor_documents: [
    {
      id: 'cd000000-0000-0000-0000-000000000001',
      contractor_id: CONTRACTOR_ID,
      document_type: 'gewerbeanmeldung',
      status: 'approved',
      file_name: 'gewerbeanmeldung.pdf',
      storage_path: `${CONTRACTOR_ID}/gewerbeanmeldung/gewerbeanmeldung.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 120000,
      issued_at: '2026-01-15',
      expires_at: null,
      uploaded_by: CONTRACTOR_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'cd000000-0000-0000-0000-000000000002',
      contractor_id: CONTRACTOR_ID,
      document_type: 'haftpflichtversicherung',
      status: 'approved',
      file_name: 'haftpflichtversicherung.pdf',
      storage_path: `${CONTRACTOR_ID}/haftpflichtversicherung/haftpflichtversicherung.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 130000,
      issued_at: '2026-01-01',
      expires_at: '2027-01-01',
      uploaded_by: CONTRACTOR_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'cd000000-0000-0000-0000-000000000003',
      contractor_id: CONTRACTOR_ID,
      document_type: 'unbedenklichkeit_finanzamt',
      status: 'approved',
      file_name: 'finanzamt.pdf',
      storage_path: `${CONTRACTOR_ID}/unbedenklichkeit_finanzamt/finanzamt.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 110000,
      issued_at: '2026-04-01',
      expires_at: '2026-05-25',
      uploaded_by: CONTRACTOR_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: 'Demo: vence pronto',
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'cd000000-0000-0000-0000-000000000004',
      contractor_id: CONTRACTOR_ID,
      document_type: 'id_passport',
      status: 'approved',
      file_name: 'ausweis.jpg',
      storage_path: `${CONTRACTOR_ID}/id_passport/ausweis.jpg`,
      mime_type: 'image/jpeg',
      size_bytes: 90000,
      issued_at: '2024-03-10',
      expires_at: '2030-03-10',
      uploaded_by: CONTRACTOR_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'cd000000-0000-0000-0000-000000000005',
      contractor_id: CONTRACTOR_ID,
      document_type: 'subcontractor_agreement',
      status: 'approved',
      file_name: 'subcontractor-agreement.pdf',
      storage_path: `${CONTRACTOR_ID}/subcontractor_agreement/subcontractor-agreement.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 160000,
      issued_at: '2026-01-15',
      expires_at: null,
      uploaded_by: ADMIN_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    // Per-worker A1 certificates — linked from subcontractor_onboarding.a1_workers.
    {
      id: 'cd000000-0000-0000-0000-000000000006',
      contractor_id: CONTRACTOR_ID,
      document_type: 'a1_bescheinigung',
      status: 'approved',
      file_name: 'a1-carlos-mendez.pdf',
      storage_path: `${CONTRACTOR_ID}/a1_bescheinigung/a1-carlos-mendez.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 95000,
      issued_at: '2026-02-01',
      expires_at: '2027-01-31',
      uploaded_by: ADMIN_ID,
      uploaded_at: LAST_WEEK,
      reviewed_by: ADMIN_ID,
      reviewed_at: LAST_WEEK,
      review_notes: null,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'cd000000-0000-0000-0000-000000000007',
      contractor_id: CONTRACTOR_ID,
      document_type: 'a1_bescheinigung',
      status: 'pending_review',
      file_name: 'a1-luis-fernandez.pdf',
      storage_path: `${CONTRACTOR_ID}/a1_bescheinigung/a1-luis-fernandez.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 92000,
      issued_at: '2026-05-01',
      expires_at: '2026-11-30',
      uploaded_by: CONTRACTOR_ID,
      uploaded_at: NOW,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],

  pin_trusted_devices: [],

  // UMTELKOMD Subunternehmer-Onboarding — one seeded compliance record for the
  // demo contractor (company data + A1 roster + verification block).
  subcontractor_onboarding: [
    {
      id: 'sc000000-0000-0000-0000-000000000001',
      contractor_id: CONTRACTOR_ID,
      company_name: 'Fibra Ibérica S.L.',
      ust_id_es: 'ESB12345678',
      address: 'Calle Mayor 12, 28013 Madrid',
      tax_number_de: '27/123/45678',
      contact_person: 'Carlos Méndez',
      contact_email: 'carlos@fibra-iberica.es',
      contact_phone: '+34 600 123 456',
      project_site: 'HXT — Rot',
      deployment_period: '01.08.2026 – 31.12.2026',
      a1_workers: [
        {
          name: 'Carlos Méndez',
          a1_valid_until: '2027-01-31',
          id_number: 'ESP-9981234',
          a1_document_id: 'cd000000-0000-0000-0000-000000000006',
        },
        {
          name: 'Luis Fernández',
          a1_valid_until: '2026-11-30',
          id_number: 'ESP-9985678',
          a1_document_id: 'cd000000-0000-0000-0000-000000000007',
        },
      ],
      checked_48b: true,
      withhold_bauabzug: false,
      ust_id_confirmed: true,
      place_date: 'Berlin, 01.07.2026',
      verified_by: 'Alejandro Herrera',
      notes: null,
      created_by: ADMIN_ID,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ],

  // Plan 009 — collaborator cycle calendar.
  // One PUBLISHED cycle (visible to contractor@demo.lumen) with all 4 milestones
  // and 2 attached orders, plus one DRAFT cycle (must NOT be visible to the
  // contractor) to prove the publish gate.
  collaborator_cycles: [
    {
      id: 'c1c1c1c1-0000-0000-0000-000000000001',
      collaborator_id: CONTRACTOR_ID,
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      period_label: 'April 2026',
      emission_date: '2026-04-06',
      review_start_date: '2026-04-10', // + 3 business days → 2026-04-15
      final_cert_date: '2026-04-20',
      payment_date: '2026-05-10', // = final_cert_date + 20 (D4)
      status: 'published',
      published_at: LAST_WEEK,
      published_by: ADMIN_ID,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'c1c1c1c1-0000-0000-0000-000000000002',
      collaborator_id: CONTRACTOR_ID,
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      period_label: 'Mai 2026 (Entwurf)',
      emission_date: '2026-05-05',
      review_start_date: '2026-05-08',
      final_cert_date: '2026-05-18',
      payment_date: '2026-06-07',
      status: 'draft',
      published_at: null,
      published_by: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  collaborator_cycle_orders: [
    { cycle_id: 'c1c1c1c1-0000-0000-0000-000000000001', work_order_id: WO_7_EXTERNAL },
    { cycle_id: 'c1c1c1c1-0000-0000-0000-000000000001', work_order_id: WO_5_PAID },
  ],

  roles: [
    {
      id: ROLE_ADMIN,
      name: 'admin',
      description: 'Full administrative access (system role)',
      is_system: true,
      auto_grant_new: true,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: ROLE_TECHNICIAN,
      name: 'technician',
      description: 'Internal field collaborator portal (system role)',
      is_system: true,
      auto_grant_new: false,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: ROLE_CONTRACTOR,
      name: 'contractor',
      description: 'External subcontractor portal (system role)',
      is_system: true,
      auto_grant_new: false,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: ROLE_SCHEDULER,
      name: 'scheduler',
      description: 'Appointment scheduler portal (system role)',
      is_system: true,
      auto_grant_new: false,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: ROLE_SUPERVISOR,
      name: 'Supervisor',
      description: 'Solo lectura: órdenes y certificación',
      is_system: false,
      auto_grant_new: false,
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ] as Array<{
    id: string
    name: string
    description: string | null
    is_system: boolean
    auto_grant_new: boolean
    is_active: boolean
    created_at: string
    updated_at: string
  }>,

  permissions: DEMO_PERMISSIONS,

  role_permissions: DEMO_ROLE_PERMISSIONS as Array<{
    role_id: string
    permission_id: string
    created_at: string
  }>,

  user_roles: [
    { user_id: ADMIN_ID, role_id: ROLE_ADMIN, created_at: LAST_WEEK },
    { user_id: TECH_ID, role_id: ROLE_TECHNICIAN, created_at: LAST_WEEK },
    { user_id: CONTRACTOR_ID, role_id: ROLE_CONTRACTOR, created_at: LAST_WEEK },
    { user_id: SCHEDULER_ID, role_id: ROLE_SCHEDULER, created_at: LAST_WEEK },
  ] as Array<{ user_id: string; role_id: string; created_at: string }>,

  user_permissions: [] as Array<{ user_id: string; permission_id: string; created_at: string }>,

  telegram_groups: [
    {
      id: 'aaaa0000-0000-0000-0000-000000000001',
      chat_id: '-1001000000001',
      name: 'Equipo Rot',
      purpose: 'tareas',
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      id: 'aaaa0000-0000-0000-0000-000000000002',
      chat_id: '-1001000000002',
      name: 'Alertas Oficina',
      purpose: 'alertas',
      is_active: true,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
  ] as Array<{
    id: string
    chat_id: string
    name: string
    purpose: string
    is_active: boolean
    created_at: string
    updated_at: string
  }>,

  event_group_mappings: [] as Array<{
    id: string
    event_type: string
    telegram_group_id: string
    is_active: boolean
    created_at: string
  }>,

  user_telegram_groups: [
    {
      id: 'bbbb0000-0000-0000-0000-000000000001',
      profile_id: TECH_ID,
      telegram_group_id: 'aaaa0000-0000-0000-0000-000000000001',
      created_at: LAST_WEEK,
    },
  ] as Array<{
    id: string
    profile_id: string
    telegram_group_id: string
    created_at: string
  }>,

  _session: { user: null, access_token: null } as DemoSession,
})

export type DemoStore = ReturnType<typeof initialFixtures>
