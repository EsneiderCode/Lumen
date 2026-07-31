/**
 * Demo-mode fixture data — seeded into the in-memory store on first load
 * and on every `demo:reset`. Designed to exercise every screen of the app.
 *
 * This is NOT real production data. All UUIDs are stable so links survive reload.
 */

import { MODULE_REGISTRY } from '@/config/permissions'
import { COMPILED_CAPTURE_PLANS } from '@/constants/capture-plans'

const ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const TECH_ID = '00000000-0000-0000-0000-000000000002'
const CONTRACTOR_ID = '00000000-0000-0000-0000-000000000003'
const SCHEDULER_ID = '00000000-0000-0000-0000-000000000004'
// Second member of team Rot. He never owns an order — he exists so the demo can
// show the rule from migration 073: the crew is documented on the order, but only
// the one responsible technician can open it.
const TECH2_ID = '00000000-0000-0000-0000-000000000005'

const CLIENT_INSYTE = '10000000-0000-0000-0000-000000000001'
const CLIENT_VANCOM = '10000000-0000-0000-0000-000000000002'
const CLIENT_FNS = '10000000-0000-0000-0000-000000000003'

const PROJECT_HXT = '20000000-0000-0000-0000-000000000001'
const PROJECT_RSD = '20000000-0000-0000-0000-000000000002'
const PROJECT_WCB = '20000000-0000-0000-0000-000000000003'
const PROJECT_GSW = '20000000-0000-0000-0000-000000000004'

const OP_DGF = '30000000-0000-0000-0000-000000000001'
const OP_GFPLUS = '30000000-0000-0000-0000-000000000002'
const OP_UGG = '30000000-0000-0000-0000-000000000003'
const OP_TELEKOM = '30000000-0000-0000-0000-000000000004'

const SI_SOPLADO_M = '40000000-0000-0000-0000-000000000001'
const SI_FUSION_AP = '40000000-0000-0000-0000-000000000002'
const SI_ALTA_BASIC = '40000000-0000-0000-0000-000000000003'
const SI_ALTA_NT = '40000000-0000-0000-0000-000000000004'
const SI_PATCHKABEL = '40000000-0000-0000-0000-000000000005'
const SI_NAS_PAKET_1 = '40000000-0000-0000-0000-000000000006'
const SI_WESTC_130 = '40000000-0000-0000-0000-000000000007'
const SI_VANCOM_160 = '40000000-0000-0000-0000-000000000008'
// FNS Infrastruktur (migración 063) — representative slice of the signed
// LV Gernsheim GSW-SUB rate card, incl. one LE (cost-passthrough) position.
const SI_FNS_TIEFBAU = '40000000-0000-0000-0000-000000000009'
const SI_FNS_EINBLAS_SNR = '40000000-0000-0000-0000-000000000010'
const SI_FNS_EINBLAS_GF = '40000000-0000-0000-0000-000000000011'
const SI_FNS_HA_KOMPLETT = '40000000-0000-0000-0000-000000000012'
const SI_FNS_HA_SNR = '40000000-0000-0000-0000-000000000013'
const SI_FNS_SAUGBAGGER_LE = '40000000-0000-0000-0000-000000000014'

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
const WO_10_SOPLADO_RA = '50000000-0000-0000-0000-000000000010'

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
      id: TECH2_ID,
      email: 'tech2@demo.lumen',
      full_name: 'Demo Técnico 2',
      role: 'technician',
      team: 'rot',
      pin_login_code: 'tech2-demo',
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
    // Migración 061: cliente nuevo, todavía sin proyectos ni órdenes.
    { id: CLIENT_FNS,    name: 'FNS Infrastruktur GmbH', code: 'FNS', is_active: true, created_at: LAST_WEEK },
  ],

  projects: [
    // city/center_* (migration 060): where the technician's trench map opens.
    // WCB deliberately has none, so the demo also covers a project without one.
    {
      id: PROJECT_HXT, code: 'HXT', name: 'Höxter Nord', client_id: CLIENT_INSYTE,
      default_operator_id: OP_DGF, default_line: 'NE3', is_active: true, created_at: LAST_WEEK,
      city: 'Höxter', center_lat: 51.7757, center_lng: 9.3811,
    },
    {
      id: PROJECT_RSD, code: 'RSD', name: 'Roßdorf 1', client_id: CLIENT_INSYTE,
      default_operator_id: OP_DGF, default_line: 'NE3', is_active: true, created_at: LAST_WEEK,
      city: 'Roßdorf', center_lat: 49.8614, center_lng: 8.7625,
    },
    {
      id: PROJECT_WCB, code: 'WCB', name: 'Westconnect', client_id: CLIENT_VANCOM,
      default_operator_id: OP_GFPLUS, default_line: 'NE4', is_active: true, created_at: LAST_WEEK,
    },
    // FNS Infrastruktur (migración 061/063): LV Gernsheim GSW-SUB on Telekom net.
    {
      id: PROJECT_GSW, code: 'GSW', name: 'Gernsheim GSW-SUB', client_id: CLIENT_FNS,
      default_operator_id: OP_TELEKOM, default_line: 'NE3', is_active: true, created_at: LAST_WEEK,
      city: 'Gernsheim', center_lat: 49.7526, center_lng: 8.4879,
    },
  ],

  operators: [
    { id: OP_DGF,    code: 'DGF',    name: 'Deutsche Glasfaser', is_active: true, created_at: LAST_WEEK },
    { id: OP_GFPLUS, code: 'GFPLUS', name: 'GlasfaserPlus',      is_active: true, created_at: LAST_WEEK },
    { id: OP_UGG,    code: 'UGG',    name: 'UGG',                is_active: true, created_at: LAST_WEEK },
    { id: OP_TELEKOM, code: 'TELEKOM', name: 'Telekom',          is_active: true, created_at: LAST_WEEK },
  ],

  service_items: [
    {
      id: SI_SOPLADO_M, code: 'SOP-M', description_de: 'Einblasen Glasfaser je Meter',
      description_es: 'Soplado por metro', unit: 'm', unit_price: 1.85, unit_price_external: 1.20,
      category: 'NE3 > Infraestructura',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'soplado',
      display_order: 10, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FUSION_AP, code: 'FUS-AP', description_de: 'Spleißung am AP (pro Schrank)',
      description_es: 'Fusión AP por armario', unit: 'Stk', unit_price: 95.00, unit_price_external: 60.00,
      category: 'NE3 > Infraestructura',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'fusion_ap',
      display_order: 20, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_ALTA_BASIC, code: 'ALTA-BASIC', description_de: 'Standard-Hausanschluss',
      description_es: 'Alta básica', unit: 'Stk', unit_price: 145.00, unit_price_external: 95.00,
      category: 'NE4 > Altas cliente Deutsche Glasfaser / UGG',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'alta',
      display_order: 30, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_ALTA_NT, code: 'ALTA-NT', description_de: 'NT-Installation und Aktivierung',
      description_es: 'Instalación NT', unit: 'Stk', unit_price: 65.00, unit_price_external: 40.00,
      category: 'NE4 > Altas cliente Deutsche Glasfaser / UGG',
      operator_id: OP_DGF, client_id: CLIENT_INSYTE, detail_form: 'nt',
      display_order: 31, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_PATCHKABEL, code: 'PATCH', description_de: 'Patchkabel Anschluss',
      description_es: 'Patchkabel', unit: 'Stk', unit_price: 38.00, unit_price_external: 22.00,
      category: 'NE4 > ONT / Aktivierung',
      operator_id: OP_GFPLUS, client_id: CLIENT_VANCOM, detail_form: 'patchkabel',
      display_order: 40, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_NAS_PAKET_1, code: 'NAS Paket 1', description_de: 'ACT_001 + HBG + GB + Termin + OTDR',
      description_es: null, unit: 'Psch.', unit_price: 589.80, unit_price_external: 400.00,
      category: 'NE4 > Hausanschluss / NAS / acometida cliente',
      operator_id: OP_DGF, client_id: null, detail_form: 'alta',
      display_order: 215, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_WESTC_130, code: 'WESTC_MDU_130', description_de: 'Mehraufwand Raumhöhe über 2,65 m',
      description_es: null, unit: 'Stück', unit_price: 21.00, unit_price_external: 15.00,
      category: 'NE4 > Suplementos / Mehraufwand',
      operator_id: null, client_id: null, detail_form: null,
      display_order: 500, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_VANCOM_160, code: 'Vancom 160', description_de: 'Denkmalschutz',
      description_es: null, unit: 'Stk', unit_price: null, unit_price_external: null,
      category: 'NE4 > Suplementos / Mehraufwand',
      operator_id: null, client_id: CLIENT_VANCOM, detail_form: null,
      display_order: 540, active: true, is_pass_through: false, notes: 'Precio según oferta', created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    // FNS Infrastruktur — representative slice of the signed rate card
    // (migración 063, LV Gernsheim GSW-SUB, precios netos firmados 27.07.2026).
    // Only visible on orders of the FNS client — demoes the client filter.
    // The LE position also demoes the pass-through rule: it never reaches the
    // technician's picker, because it is settled at actual cost.
    {
      id: SI_FNS_TIEFBAU, code: '10030300', description_de: 'Tiefbauarbeiten',
      description_es: 'Obra civil (zanja)', unit: 'm', unit_price: 23.28, unit_price_external: null,
      category: 'FNS > Gr. 03 Tiefbau (Graben)',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: null,
      display_order: 1010, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FNS_EINBLAS_SNR, code: '10030340', description_de: 'Einzieh- und Einblasarbeiten für SNR(V)',
      description_es: 'Tendido y soplado de SNR(V)', unit: 'm', unit_price: 1.88, unit_price_external: null,
      category: 'FNS > Gr. 04 Kabelzug / Kabeleinblasung',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: 'soplado',
      display_order: 1035, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FNS_EINBLAS_GF, code: '10030341', description_de: 'Glasfaserkabel einblasen',
      description_es: 'Soplado de cable de fibra óptica', unit: 'm', unit_price: 0.77, unit_price_external: null,
      category: 'FNS > Gr. 04 Kabelzug / Kabeleinblasung',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: 'soplado',
      display_order: 1040, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FNS_HA_KOMPLETT, code: '10030360', description_de: 'Gf-Hausanschluss komplett herstellen',
      description_es: 'Acometida de fibra completa', unit: 'Stück', unit_price: 388.75, unit_price_external: null,
      category: 'FNS > Gr. 06 FTTH – Hausanschluss',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: 'alta',
      display_order: 1050, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FNS_HA_SNR, code: '10030362', description_de: 'Gf-Hausanschluss nur SNR',
      description_es: 'Acometida de fibra solo SNR', unit: 'Stück', unit_price: 228.06, unit_price_external: null,
      category: 'FNS > Gr. 06 FTTH – Hausanschluss',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: 'alta',
      display_order: 1055, active: true, is_pass_through: false, notes: null, created_at: LAST_WEEK, updated_at: LAST_WEEK,
    },
    {
      id: SI_FNS_SAUGBAGGER_LE, code: '10081334', description_de: 'Einsatz Saugbagger',
      description_es: 'Empleo de excavadora de succión', unit: 'LE', unit_price: null, unit_price_external: null,
      category: 'FNS > Gr. 10 Tiefbau E2 (Verkehrssicherung)',
      operator_id: OP_TELEKOM, client_id: CLIENT_FNS, detail_form: null,
      display_order: 1150, active: true, is_pass_through: true,
      notes: 'LE — durchlaufende Position, Abrechnung nach tatsächlichem Aufwand',
      created_at: LAST_WEEK, updated_at: LAST_WEEK,
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
      // Migración 073: la cuadrilla queda documentada, el responsable es uno solo.
      // Demo Técnico 2 aparece aquí y aun así no puede abrir la orden.
      assigned_team_roster: [
        { profile_id: TECH_ID, full_name: 'Demo Técnico', role: 'technician', is_responsible: true },
        { profile_id: TECH2_ID, full_name: 'Demo Técnico 2', role: 'technician', is_responsible: false },
      ],
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
    // 10 — Soplado de RA: the same 'soplado' work type captured under the
    // 'soplado_ra' plan (migration 053). The only order in the demo with a
    // capture_plan_key, so the plan-driven Rückmeldung can be shown without
    // credentials: mandatory photos, trenches, incidents and the duct checklist.
    {
      id: WO_10_SOPLADO_RA, order_number: 'LUM-20260428-0010',
      client_id: CLIENT_INSYTE, project_id: PROJECT_HXT, operator_id: OP_DGF,
      line: 'NE3', work_type: 'soplado', status: 'in_progress', priority: 'normal',
      capture_plan_key: 'soplado_ra',
      // Referencia de obra (migración 064): la única orden de la demo que la
      // lleva, para que se vea «HXT001-DP021» en las listas y «Soplado RA» en
      // el tipo sin necesidad de credenciales.
      segment_kind: 'ra', pop_code: '001', dp_code: '021',
      assigned_team: 'rot', assigned_technician: TECH_ID, assigned_date: '2026-04-28',
      assigned_team_roster: [
        { profile_id: TECH_ID, full_name: 'Demo Técnico', role: 'technician', is_responsible: true },
        { profile_id: TECH2_ID, full_name: 'Demo Técnico 2', role: 'technician', is_responsible: false },
      ],
      address: 'Corveyer Allee 40', postal_code: '37671', city: 'Höxter',
      internal_notes: 'Demo: soplado de RA — plan de captura con catas e incidencias',
      assigned_detail_snapshot: null,
      service_item_id: SI_SOPLADO_M, created_by: ADMIN_ID,
      created_at: YESTERDAY, updated_at: NOW,
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
    // Mirror of the capture report of the Soplado de RA order — the phase-2
    // double write, which is what the certification gate still reads.
    { id: 'd1000000-0000-0000-0000-000000000010', work_order_id: WO_10_SOPLADO_RA, meters: 128, section: 'DP-12 → POP-2', tube_diameter: '7/3.5', result: 'OK', created_at: NOW },
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
    { id: 'p0000000-0000-0000-0000-000000000031', work_order_id: WO_3, storage_path: 'demo/wo3-before.jpg', photo_type: 'before', section_key: 'photos', slot_key: 'before', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000032', work_order_id: WO_3, storage_path: 'demo/wo3-during.jpg', photo_type: 'during', section_key: 'photos', slot_key: 'during', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000033', work_order_id: WO_3, storage_path: 'demo/wo3-after.jpg',  photo_type: 'after', section_key: 'photos', slot_key: 'after', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: NOW },
    { id: 'p0000000-0000-0000-0000-000000000041', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-before.jpg', photo_type: 'before', section_key: 'photos', slot_key: 'before', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000042', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-during.jpg', photo_type: 'during', section_key: 'photos', slot_key: 'during', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000043', work_order_id: WO_4_DIRECT, storage_path: 'demo/wo4-after.jpg',  photo_type: 'after', section_key: 'photos', slot_key: 'after', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000051', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-before.jpg', photo_type: 'before', section_key: 'photos', slot_key: 'before', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000052', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-during.jpg', photo_type: 'during', section_key: 'photos', slot_key: 'during', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000053', work_order_id: WO_5_PAID,   storage_path: 'demo/wo5-after.jpg',  photo_type: 'after', section_key: 'photos', slot_key: 'after', item_id: null, caption: null, uploaded_by: TECH_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000071', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-before.jpg', photo_type: 'before', section_key: 'photos', slot_key: 'before', item_id: null, caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000072', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-during.jpg', photo_type: 'during', section_key: 'photos', slot_key: 'during', item_id: null, caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
    { id: 'p0000000-0000-0000-0000-000000000073', work_order_id: WO_7_EXTERNAL, storage_path: 'demo/wo7-after.jpg',  photo_type: 'after', section_key: 'photos', slot_key: 'after', item_id: null, caption: null, uploaded_by: CONTRACTOR_ID, created_at: LAST_WEEK },
    // Soplado de RA (plan 'soplado_ra'): photos stamped with their slot, the
    // trench they belong to and where they were taken — this is what the trench
    // map of the admin order detail draws.
    { id: 'p0000000-0000-0000-0000-000000000101', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-fiber-dp.jpg',       photo_type: 'before', section_key: 'mandatory', slot_key: 'fiber_dp',          item_id: null,          caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77648, lng: 9.37982, accuracy_m: 6 },
    { id: 'p0000000-0000-0000-0000-000000000102', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-gasblock.jpg',       photo_type: 'during', section_key: 'mandatory', slot_key: 'fiber_dp_gasblock', item_id: null,          caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77651, lng: 9.37987, accuracy_m: 7 },
    { id: 'p0000000-0000-0000-0000-000000000103', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-pop-label.jpg',      photo_type: 'after',  section_key: 'mandatory', slot_key: 'fiber_pop_label',   item_id: null,          caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77802, lng: 9.38301, accuracy_m: 9 },
    { id: 'p0000000-0000-0000-0000-000000000104', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-balloon-pop.jpg',    photo_type: 'after',  section_key: 'mandatory', slot_key: 'balloon_pop',       item_id: null,          caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77805, lng: 9.38308, accuracy_m: 9 },
    { id: 'p0000000-0000-0000-0000-000000000111', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-cata1-before.jpg',   photo_type: 'before', section_key: 'catas',     slot_key: 'before_open',       item_id: 'cata-demo-1', caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77685, lng: 9.38042, accuracy_m: 8 },
    { id: 'p0000000-0000-0000-0000-000000000112', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-cata1-open.jpg',     photo_type: 'during', section_key: 'catas',     slot_key: 'during_open',       item_id: 'cata-demo-1', caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77686, lng: 9.38044, accuracy_m: 8 },
    { id: 'p0000000-0000-0000-0000-000000000113', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-cata1-closed.jpg',   photo_type: 'after',  section_key: 'catas',     slot_key: 'closed',            item_id: 'cata-demo-1', caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77684, lng: 9.38041, accuracy_m: 8 },
    { id: 'p0000000-0000-0000-0000-000000000121', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-cata2-before.jpg',   photo_type: 'before', section_key: 'catas',     slot_key: 'before_open',       item_id: 'cata-demo-2', caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77731, lng: 9.38215, accuracy_m: 11 },
    { id: 'p0000000-0000-0000-0000-000000000122', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-cata2-open.jpg',     photo_type: 'during', section_key: 'catas',     slot_key: 'during_open',       item_id: 'cata-demo-2', caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77733, lng: 9.38217, accuracy_m: 11 },
    { id: 'p0000000-0000-0000-0000-000000000131', work_order_id: WO_10_SOPLADO_RA, storage_path: 'demo/wo10-incident.jpg',       photo_type: 'during', section_key: 'incidents', slot_key: 'photo',             item_id: null,          caption: null, uploaded_by: TECH_ID, created_at: NOW, taken_at: NOW, lat: 51.77712, lng: 9.38134, accuracy_m: 10 },
  ],

  // Capture plans (migrations 052 + 053). The demo carries every compiled plan —
  // the defaults and the "Soplado de RA" variant — so the Rückmeldung renders
  // its plan-driven form with no credentials.
  capture_plans: Object.values(COMPILED_CAPTURE_PLANS).map((plan) => ({
    key: plan.key,
    version: plan.version,
    definition: plan,
    is_active: true,
    created_at: LAST_WEEK,
    updated_at: LAST_WEEK,
  })),

  // Every order's Rückmeldung, in the one place the app reads it (phase 7). The
  // wo_detail_* rows below are left exactly as they are, because that is what
  // production looks like after migration 055: the legacy rows still sit there,
  // nothing reads them any more.
  //
  // The Soplado de RA order carries the interesting one — two trenches (one
  // still open, hence its safety signage slot), an incident and a duct change.
  // Without it the trench map has nothing to draw in demo mode.
  work_order_capture_reports: [
    {
      work_order_id: WO_2,
      plan_key: 'fusion_ap',
      plan_version: 1,
      answers: {
        details: {
          cabinet_code: 'NE4-S-007',
          splice_count: 24,
          fiber_type: 'G.652D',
          fusion_losses: 0.08,
          has_measurement_cert: false,
        },
      } as Record<string, unknown>,
      reported_service_items: [],
      submitted_at: null,
      updated_by: TECH_ID,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      work_order_id: WO_3,
      plan_key: 'alta',
      plan_version: 1,
      answers: {
        details: {
          access_type: 'Tiefbau',
          equipment_installed: 'NT-1234, ONT-5678',
          client_signature: true,
        },
      } as Record<string, unknown>,
      reported_service_items: [],
      submitted_at: NOW,
      updated_by: TECH_ID,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      work_order_id: WO_4_DIRECT,
      plan_key: 'patchkabel',
      plan_version: 1,
      answers: {
        details: {
          connected_section: 'POP→Rack-3',
          cable_length: 2.5,
          connector_type: 'LC/APC',
          test_result: 'OK',
        },
      } as Record<string, unknown>,
      reported_service_items: [],
      submitted_at: LAST_WEEK,
      updated_by: TECH_ID,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      work_order_id: WO_5_PAID,
      plan_key: 'fusion_ap',
      plan_version: 1,
      answers: {
        details: {
          cabinet_code: 'NE4-S-001',
          splice_count: 16,
          fiber_type: 'G.657A1',
          fusion_losses: 0.05,
          has_measurement_cert: true,
        },
      } as Record<string, unknown>,
      reported_service_items: [],
      submitted_at: LAST_WEEK,
      updated_by: TECH_ID,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      // The one that bills: its reported services moved out of wo_detail_alta.
      work_order_id: WO_7_EXTERNAL,
      plan_key: 'alta',
      plan_version: 1,
      answers: {
        details: {
          access_type: 'Hausanschluss',
          equipment_installed: 'NT-9001, ONT-7700, Patchkabel 5m',
          client_signature: true,
        },
      } as Record<string, unknown>,
      reported_service_items: [
        { service_item_id: SI_ALTA_BASIC, qty: 1, notes: null },
        { service_item_id: SI_ALTA_NT, qty: 1, notes: null },
        { service_item_id: SI_PATCHKABEL, qty: 1, notes: null },
      ],
      submitted_at: LAST_WEEK,
      updated_by: TECH_ID,
      created_at: LAST_WEEK,
      updated_at: LAST_WEEK,
    },
    {
      work_order_id: WO_10_SOPLADO_RA,
      plan_key: 'soplado_ra',
      plan_version: 3,
      answers: {
        // La primera cata está cerrada del todo; la segunda tiene su posición
        // pero aún sin confirmar el pin, que es lo que hay que ver en la demo.
        catas: [
          {
            id: 'cata-demo-1',
            values: {
              left_open: false,
              depth_cm: 62,
              location: { lat: 51.77685, lng: 9.38042, accuracy_m: 8 },
              pin_confirmed: NOW,
            },
          },
          {
            id: 'cata-demo-2',
            values: {
              left_open: true,
              depth_cm: 48,
              location: { lat: 51.77731, lng: 9.38215, accuracy_m: 11 },
            },
          },
        ],
        incidents: { description: 'Rohr 4 blockiert auf Höhe Hausnummer 28' },
        checklist: {
          duct_as_planned: false,
          trunk_used: 'Strang 3',
          duct_used: 'Rohr 7 (grün)',
          change_reason: 'Geplantes Rohr blockiert',
        },
        details: { result: 'Abgeschlossen', meters: 128, tube_diameter: '7/3.5' },
      } as Record<string, unknown>,
      reported_service_items: [],
      submitted_at: null,
      updated_by: TECH_ID,
      created_at: NOW,
      updated_at: NOW,
    },
  ] as Array<{
    work_order_id: string
    plan_key: string
    plan_version: number
    answers: Record<string, unknown>
    reported_service_items: Array<{ service_item_id: string; qty: number; notes: string | null }>
    submitted_at: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
  }>,

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
  pin_trusted_devices: [],
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

  work_order_telegram_groups: [
    {
      id: 'bbbb0000-0000-0000-0000-000000000001',
      work_order_id: WO_1,
      telegram_group_id: 'aaaa0000-0000-0000-0000-000000000001',
      created_at: LAST_WEEK,
    },
    {
      id: 'bbbb0000-0000-0000-0000-000000000002',
      work_order_id: WO_1,
      telegram_group_id: 'aaaa0000-0000-0000-0000-000000000002',
      created_at: LAST_WEEK,
    },
  ] as Array<{
    id: string
    work_order_id: string
    telegram_group_id: string
    created_at: string
  }>,

  // ── Compliance module (migrations 042–046) ────────────────────────────────
  // Minimal but representative slice of the requirement matrix so the new
  // compliance portal + review inbox work offline. The demo contractor is
  // modelled as a Spanish subcontractor company with two posted workers.
  document_types: [
    { id: 'd7000000-0000-0000-0000-000000000001', code: 'subcontractor_agreement', name_i18n: { es: 'Contrato de subcontratación firmado', de: 'Unterschriebener Nachunternehmervertrag', en: 'Signed subcontractor agreement' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000002', code: 'rc_insurance', name_i18n: { es: 'Seguro de responsabilidad civil', de: 'Betriebshaftpflichtversicherung', en: 'Liability insurance' }, description_i18n: null, metadata_schema: [{ key: 'amount', type: 'number' }], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000003', code: 'ss_clearance_national', name_i18n: { es: 'Certificado de corriente de pago de la Seguridad Social', de: 'Unbedenklichkeitsbescheinigung der Sozialversicherung', en: 'Social security clearance certificate' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000004', code: 'business_registration', name_i18n: { es: 'Registro mercantil / alta de actividad', de: 'Handelsregisterauszug bzw. Gewerbeanmeldung', en: 'Business / commercial registration' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000005', code: 'a1_certificate', name_i18n: { es: 'Certificado A1', de: 'A1-Bescheinigung', en: 'A1 certificate' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000006', code: 'id_document', name_i18n: { es: 'Documento de identidad / pasaporte', de: 'Ausweis / Reisepass', en: 'ID document / passport' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000007', code: 'employment_contract', name_i18n: { es: 'Contrato de trabajo', de: 'Arbeitsvertrag', en: 'Employment contract' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd7000000-0000-0000-0000-000000000008', code: 'freistellung_48b', name_i18n: { es: 'Freistellungsbescheinigung §48b EStG', de: 'Freistellungsbescheinigung §48b EStG', en: '§48b EStG exemption certificate' }, description_i18n: null, metadata_schema: [], template_storage_path: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  document_requirements: [
    { id: 'd8000000-0000-0000-0000-000000000001', document_type_id: 'd7000000-0000-0000-0000-000000000001', applies_to: 'company', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'no_expiry', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000002', document_type_id: 'd7000000-0000-0000-0000-000000000002', applies_to: 'company', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'expiry_required', validity_days: null, min_amount: 500000, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000003', document_type_id: 'd7000000-0000-0000-0000-000000000003', applies_to: 'company', origin: 'ES', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'days_from_issue', validity_days: 90, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000004', document_type_id: 'd7000000-0000-0000-0000-000000000004', applies_to: 'company', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'no_expiry', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000005', document_type_id: 'd7000000-0000-0000-0000-000000000005', applies_to: 'company_worker', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'expiry_required', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000006', document_type_id: 'd7000000-0000-0000-0000-000000000006', applies_to: 'company_worker', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'no_expiry', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000007', document_type_id: 'd7000000-0000-0000-0000-000000000007', applies_to: 'internal_employee', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'no_expiry', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000008', document_type_id: 'd7000000-0000-0000-0000-000000000006', applies_to: 'internal_employee', origin: 'ALL', scope: 'entity', is_mandatory: true, conditions: {}, validity_rule: 'no_expiry', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [], on_missing_action: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'd8000000-0000-0000-0000-000000000009', document_type_id: 'd7000000-0000-0000-0000-000000000008', applies_to: 'company', origin: 'ALL', scope: 'entity', is_mandatory: false, conditions: {}, validity_rule: 'expiry_required', validity_days: null, min_amount: null, min_amount_currency: 'EUR', requires_coverage_confirmation: false, notify_days: [30], on_missing_action: 'notify_billing_withholding', notes: 'Sin ella: retención 15% Bauabzugsteuer', is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  compliance_entities: [
    { id: 'ce000000-0000-0000-0000-000000000001', kind: 'company', parent_entity_id: null, profile_id: CONTRACTOR_ID, employee_id: null, display_name: 'Fibra Ibérica S.L.', country_code: 'ES', nationality_country: null, attributes: { hires_workers: true }, legal_ids: { ust_id_es: 'ESB12345678', tax_number_de: '27/123/45678' }, contact_email: 'carlos@fibra-iberica.es', contact_phone: '+34 600 123 456', address: 'Calle Mayor 12, 28013 Madrid', scheinselbst_check: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ce000000-0000-0000-0000-000000000002', kind: 'company_worker', parent_entity_id: 'ce000000-0000-0000-0000-000000000001', profile_id: null, employee_id: null, display_name: 'Carlos Méndez', country_code: 'ES', nationality_country: 'ES', attributes: {}, legal_ids: { id_number: 'ESP-9981234' }, contact_email: null, contact_phone: null, address: null, scheinselbst_check: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ce000000-0000-0000-0000-000000000003', kind: 'company_worker', parent_entity_id: 'ce000000-0000-0000-0000-000000000001', profile_id: null, employee_id: null, display_name: 'Luis Fernández', country_code: 'ES', nationality_country: 'ES', attributes: {}, legal_ids: { id_number: 'ESP-9985678' }, contact_email: null, contact_phone: null, address: null, scheinselbst_check: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ce000000-0000-0000-0000-000000000004', kind: 'internal_employee', parent_entity_id: null, profile_id: null, employee_id: EMPLOYEE_TECH, display_name: 'Max Mustermann', country_code: 'DE', nationality_country: 'DE', attributes: {}, legal_ids: {}, contact_email: null, contact_phone: null, address: null, scheinselbst_check: null, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ce000000-0000-0000-0000-000000000005', kind: 'freelancer', parent_entity_id: null, profile_id: null, employee_id: null, display_name: 'Ana Ruiz (Autónoma)', country_code: 'ES', nationality_country: 'ES', attributes: {}, legal_ids: { nif: 'ES-12345678Z' }, contact_email: 'ana.ruiz@example.es', contact_phone: null, address: null, scheinselbst_check: { answers: { single_client: true, client_instructions: true, integrated_org: true, no_entrepreneurial_risk: true, fixed_hours: true }, note: 'Trabaja en exclusiva para nosotros con horario fijo.', score: 9, max_score: 14, level: 'high', assessed_by: ADMIN_ID, assessed_at: LAST_WEEK }, notes: null, is_active: true, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  document_versions: [
    { id: 'dv000000-0000-0000-0000-000000000001', entity_document_id: 'ed000000-0000-0000-0000-000000000001', version_number: 1, file_name: 'contrato-subcontratacion.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000001/ed1/contrato.pdf', mime_type: 'application/pdf', size_bytes: 84000, submitted_metadata: {}, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000002', entity_document_id: 'ed000000-0000-0000-0000-000000000002', version_number: 1, file_name: 'seguro-rc.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000001/ed2/rc.pdf', mime_type: 'application/pdf', size_bytes: 120000, submitted_metadata: { amount: 1000000, expires_at: '2027-06-30' }, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000003', entity_document_id: 'ed000000-0000-0000-0000-000000000003', version_number: 1, file_name: 'ss-corriente.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000001/ed3/ss.pdf', mime_type: 'application/pdf', size_bytes: 64000, submitted_metadata: { issued_at: '2026-04-20' }, uploaded_by: CONTRACTOR_ID, uploaded_at: YESTERDAY },
    { id: 'dv000000-0000-0000-0000-000000000004', entity_document_id: 'ed000000-0000-0000-0000-000000000004', version_number: 1, file_name: 'registro-mercantil.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000001/ed4/reg.pdf', mime_type: 'application/pdf', size_bytes: 72000, submitted_metadata: {}, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000005', entity_document_id: 'ed000000-0000-0000-0000-000000000005', version_number: 1, file_name: 'a1-carlos.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000002/ed5/a1.pdf', mime_type: 'application/pdf', size_bytes: 55000, submitted_metadata: { expires_at: '2027-01-31' }, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000006', entity_document_id: 'ed000000-0000-0000-0000-000000000006', version_number: 1, file_name: 'dni-carlos.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000002/ed6/dni.pdf', mime_type: 'application/pdf', size_bytes: 40000, submitted_metadata: {}, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000007', entity_document_id: 'ed000000-0000-0000-0000-000000000007', version_number: 1, file_name: 'a1-luis.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000003/ed7/a1.pdf', mime_type: 'application/pdf', size_bytes: 51000, submitted_metadata: { expires_at: '2026-03-15' }, uploaded_by: CONTRACTOR_ID, uploaded_at: LAST_WEEK },
    { id: 'dv000000-0000-0000-0000-000000000008', entity_document_id: 'ed000000-0000-0000-0000-000000000009', version_number: 1, file_name: 'arbeitsvertrag-max.pdf', storage_bucket: 'compliance-documents', storage_path: 'ce000000-0000-0000-0000-000000000004/ed9/vertrag.pdf', mime_type: 'application/pdf', size_bytes: 61000, submitted_metadata: {}, uploaded_by: ADMIN_ID, uploaded_at: LAST_WEEK },
  ],

  entity_documents: [
    { id: 'ed000000-0000-0000-0000-000000000001', entity_id: 'ce000000-0000-0000-0000-000000000001', requirement_id: 'd8000000-0000-0000-0000-000000000001', document_type_id: 'd7000000-0000-0000-0000-000000000001', project_id: null, status: 'approved', current_version_id: 'dv000000-0000-0000-0000-000000000001', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: {}, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000002', entity_id: 'ce000000-0000-0000-0000-000000000001', requirement_id: 'd8000000-0000-0000-0000-000000000002', document_type_id: 'd7000000-0000-0000-0000-000000000002', project_id: null, status: 'approved', current_version_id: 'dv000000-0000-0000-0000-000000000002', approved_issued_at: '2026-01-01', approved_expires_at: '2027-06-30', approved_amount: 1000000, approved_metadata: { amount: 1000000 }, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000003', entity_id: 'ce000000-0000-0000-0000-000000000001', requirement_id: 'd8000000-0000-0000-0000-000000000003', document_type_id: 'd7000000-0000-0000-0000-000000000003', project_id: null, status: 'in_review', current_version_id: 'dv000000-0000-0000-0000-000000000003', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: null, coverage_confirmed: false, created_at: YESTERDAY, updated_at: YESTERDAY },
    { id: 'ed000000-0000-0000-0000-000000000004', entity_id: 'ce000000-0000-0000-0000-000000000001', requirement_id: 'd8000000-0000-0000-0000-000000000004', document_type_id: 'd7000000-0000-0000-0000-000000000004', project_id: null, status: 'approved', current_version_id: 'dv000000-0000-0000-0000-000000000004', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: {}, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000005', entity_id: 'ce000000-0000-0000-0000-000000000002', requirement_id: 'd8000000-0000-0000-0000-000000000005', document_type_id: 'd7000000-0000-0000-0000-000000000005', project_id: null, status: 'expired', current_version_id: 'dv000000-0000-0000-0000-000000000005', approved_issued_at: '2025-08-01', approved_expires_at: '2026-02-28', approved_amount: null, approved_metadata: {}, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000006', entity_id: 'ce000000-0000-0000-0000-000000000002', requirement_id: 'd8000000-0000-0000-0000-000000000006', document_type_id: 'd7000000-0000-0000-0000-000000000006', project_id: null, status: 'approved', current_version_id: 'dv000000-0000-0000-0000-000000000006', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: {}, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000007', entity_id: 'ce000000-0000-0000-0000-000000000003', requirement_id: 'd8000000-0000-0000-0000-000000000005', document_type_id: 'd7000000-0000-0000-0000-000000000005', project_id: null, status: 'rejected', current_version_id: 'dv000000-0000-0000-0000-000000000007', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: null, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: YESTERDAY },
    { id: 'ed000000-0000-0000-0000-000000000008', entity_id: 'ce000000-0000-0000-0000-000000000003', requirement_id: 'd8000000-0000-0000-0000-000000000006', document_type_id: 'd7000000-0000-0000-0000-000000000006', project_id: null, status: 'pending', current_version_id: null, approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: null, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000009', entity_id: 'ce000000-0000-0000-0000-000000000004', requirement_id: 'd8000000-0000-0000-0000-000000000007', document_type_id: 'd7000000-0000-0000-0000-000000000007', project_id: null, status: 'approved', current_version_id: 'dv000000-0000-0000-0000-000000000008', approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: {}, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000010', entity_id: 'ce000000-0000-0000-0000-000000000004', requirement_id: 'd8000000-0000-0000-0000-000000000008', document_type_id: 'd7000000-0000-0000-0000-000000000006', project_id: null, status: 'pending', current_version_id: null, approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: null, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
    { id: 'ed000000-0000-0000-0000-000000000011', entity_id: 'ce000000-0000-0000-0000-000000000001', requirement_id: 'd8000000-0000-0000-0000-000000000009', document_type_id: 'd7000000-0000-0000-0000-000000000008', project_id: null, status: 'pending', current_version_id: null, approved_issued_at: null, approved_expires_at: null, approved_amount: null, approved_metadata: null, coverage_confirmed: false, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  document_reviews: [
    { id: 'dr000000-0000-0000-0000-000000000001', version_id: 'dv000000-0000-0000-0000-000000000002', reviewer_id: ADMIN_ID, action: 'approved', approved_metadata: { amount: 1000000, expires_at: '2027-06-30' }, rejection_reasons: null, rejection_text: null, created_at: LAST_WEEK },
    { id: 'dr000000-0000-0000-0000-000000000002', version_id: 'dv000000-0000-0000-0000-000000000007', reviewer_id: ADMIN_ID, action: 'rejected', approved_metadata: null, rejection_reasons: ['caducado', 'fechas_no_cubren_obra'], rejection_text: 'El A1 caducó el 15.03.2026 y no cubre el periodo de la obra. Sube uno vigente.', created_at: YESTERDAY },
  ],

  document_access_log: [] as Array<{
    id: string
    version_id: string
    accessed_by: string
    action: string
    created_at: string
  }>,

  project_assignments: [
    { id: 'pa000000-0000-0000-0000-000000000001', entity_id: 'ce000000-0000-0000-0000-000000000001', project_id: PROJECT_HXT, start_date: '2026-04-01', end_date: '2026-12-31', status: 'confirmed', override: false, override_by: null, override_reason: null, created_by: ADMIN_ID, created_at: LAST_WEEK, updated_at: LAST_WEEK },
  ],

  // Fila única de ajustes de cumplimiento (migración 062). El encargado empieza
  // sin asignar: así se ve el aviso de «sin encargado» en Configuración.
  compliance_settings: [
    { id: true, review_assignee_id: null as string | null, updated_at: LAST_WEEK, updated_by: null as string | null },
  ],

  notifications: [
    { id: 'no000000-0000-0000-0000-000000000001', recipient_id: ADMIN_ID, category: 'doc_rejected', level: 'err', payload: { entity_id: 'ce000000-0000-0000-0000-000000000003', entity_name: 'Luis Fernández', doc_type_code: 'a1_certificate', doc_type_name: { es: 'Certificado A1', de: 'A1-Bescheinigung', en: 'A1 certificate' }, action: 'rejected' }, dedupe_key: 'review:dr000000-0000-0000-0000-000000000002', read_at: null, created_at: YESTERDAY },
    { id: 'no000000-0000-0000-0000-000000000002', recipient_id: ADMIN_ID, category: 'doc_expiring', level: 'warn', payload: { entity_id: 'ce000000-0000-0000-0000-000000000001', entity_document_id: 'ed000000-0000-0000-0000-000000000002', entity_name: 'Fibra Ibérica S.L.', doc_type_code: 'rc_insurance', doc_type_name: { es: 'Seguro de responsabilidad civil', de: 'Betriebshaftpflichtversicherung', en: 'Liability insurance' }, status: 'expiring', days: 21 }, dedupe_key: 'sweep:ed000000-0000-0000-0000-000000000002:expiring', read_at: null, created_at: NOW },
  ],

  _session: { user: null, access_token: null } as DemoSession,
})

export type DemoStore = ReturnType<typeof initialFixtures>
