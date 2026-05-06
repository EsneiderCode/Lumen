import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { TeamColor } from '@/types/enums'
import type {
  ConsumptionCorrectionRequired,
  ConsumptionDraft,
  InventoryVehicle,
  Material,
  MaterialImportPreviewRow,
  MaterialPayload,
  MaterialWithClient,
  VehiclePayload,
  VehicleStockRow,
} from '@/types/material-inventory'
import {
  applyConsumptionBalance,
  normalizeMaterialKey,
  parseGfpRows,
  parseWestconnectRows,
} from '@/services/materialInventoryRules'

type TableName =
  | 'materials'
  | 'inventory_vehicles'
  | 'vehicle_material_stock'
  | 'work_order_material_consumptions'
  | 'stock_movements'

const table = (name: TableName) => supabase.from(name)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error')
}

export async function parseMaterialWorkbook(file: File): Promise<{
  data: MaterialImportPreviewRow[]
  error: string | null
}> {
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const allRows = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
    })

    const gfp = parseGfpRows(allRows)
    if (gfp.length > 0) return { data: gfp, error: null }

    const westconnect = parseWestconnectRows(allRows)
    if (westconnect.length > 0) return { data: westconnect, error: null }

    return { data: [], error: 'Kein unterstütztes Materialformat gefunden.' }
  } catch (err) {
    return { data: [], error: errorMessage(err) }
  }
}

export async function fetchMaterials(includeInactive = false) {
  let query = table('materials')
    .select('*, clients (id, code, name)')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  return {
    data: (data ?? []) as unknown as MaterialWithClient[],
    error: error?.message ?? null,
  }
}

export async function createMaterial(payload: MaterialPayload) {
  const { data, error } = await table('materials')
    .insert(payload as never)
    .select()
    .single()
  return { data: data as Material | null, error: error?.message ?? null }
}

export async function updateMaterial(id: string, payload: Partial<MaterialPayload>) {
  const { data, error } = await table('materials')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single()
  return { data: data as Material | null, error: error?.message ?? null }
}

export async function deactivateMaterial(id: string) {
  const { error } = await table('materials').update({ is_active: false }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function fetchVehicles(options: { team?: TeamColor | null; includeInactive?: boolean } = {}) {
  let query = table('inventory_vehicles')
    .select('*')
    .order('team', { ascending: true })
    .order('name', { ascending: true })

  if (!options.includeInactive) query = query.eq('active', true)
  if (options.team) query = query.eq('team', options.team)

  const { data, error } = await query
  return { data: (data ?? []) as InventoryVehicle[], error: error?.message ?? null }
}

export async function createVehicle(payload: VehiclePayload) {
  const { data, error } = await table('inventory_vehicles')
    .insert(payload as never)
    .select()
    .single()
  return { data: data as InventoryVehicle | null, error: error?.message ?? null }
}

export async function updateVehicle(id: string, payload: Partial<VehiclePayload>) {
  const { data, error } = await table('inventory_vehicles')
    .update(payload as never)
    .eq('id', id)
    .select()
    .single()
  return { data: data as InventoryVehicle | null, error: error?.message ?? null }
}

export async function deactivateVehicle(id: string) {
  const { error } = await table('inventory_vehicles').update({ active: false }).eq('id', id)
  return { error: error?.message ?? null }
}

async function fetchMaterialsByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, Material>()
  const { data } = await table('materials').select('*').in('id', ids)
  return new Map(((data ?? []) as Material[]).map((m) => [m.id, m]))
}

export async function fetchVehicleStock(vehicleId: string) {
  const { data, error } = await table('vehicle_material_stock')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('updated_at', { ascending: false })
  if (error) return { data: [] as VehicleStockRow[], error: error.message }

  const rows = (data ?? []) as Array<VehicleStockRow>
  const materials = await fetchMaterialsByIds(rows.map((r) => r.material_id))
  return {
    data: rows
      .map((row) => ({ ...row, material: materials.get(row.material_id) }))
      .filter((row): row is VehicleStockRow => Boolean(row.material)),
    error: null,
  }
}

async function findStock(vehicleId: string, materialId: string) {
  const { data, error } = await table('vehicle_material_stock')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('material_id', materialId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; quantity: number } | null
}

async function setStock(args: {
  vehicleId: string
  materialId: string
  quantity: number
}) {
  const existing = await findStock(args.vehicleId, args.materialId)
  if (existing) {
    const { error } = await table('vehicle_material_stock')
      .update({ quantity: args.quantity })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return existing.id
  }

  const { data, error } = await table('vehicle_material_stock')
    .insert({
      vehicle_id: args.vehicleId,
      material_id: args.materialId,
      quantity: args.quantity,
    } as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

async function insertStockMovement(args: {
  vehicleId: string
  materialId: string
  workOrderId?: string | null
  movementType: 'import' | 'admin_adjustment' | 'tech_correction' | 'consumption'
  quantityDelta: number
  stockBefore: number
  stockAfter: number
  reason?: string | null
  createdBy: string
}) {
  const { error } = await table('stock_movements').insert({
    vehicle_id: args.vehicleId,
    material_id: args.materialId,
    work_order_id: args.workOrderId ?? null,
    movement_type: args.movementType,
    quantity_delta: args.quantityDelta,
    stock_before: args.stockBefore,
    stock_after: args.stockAfter,
    reason: args.reason ?? null,
    created_by: args.createdBy,
  } as never)
  if (error) throw new Error(error.message)
}

async function addStock(args: {
  vehicleId: string
  materialId: string
  quantity: number
  createdBy: string
  reason: string
}) {
  const existing = await findStock(args.vehicleId, args.materialId)
  const before = Number(existing?.quantity ?? 0)
  const after = before + args.quantity
  await setStock({ vehicleId: args.vehicleId, materialId: args.materialId, quantity: after })
  await insertStockMovement({
    vehicleId: args.vehicleId,
    materialId: args.materialId,
    movementType: 'import',
    quantityDelta: args.quantity,
    stockBefore: before,
    stockAfter: after,
    reason: args.reason,
    createdBy: args.createdBy,
  })
}

export async function commitMaterialImport(args: {
  clientId: string
  vehicleId: string
  rows: MaterialImportPreviewRow[]
  createdBy: string
}) {
  try {
    const validRows = args.rows.filter((r) => r.valid && r.quantity > 0)
    const { data: existingMaterials, error } = await table('materials')
      .select('*')
      .eq('catalog_client_id', args.clientId)
    if (error) return { imported: 0, error: error.message }

    const existing = (existingMaterials ?? []) as Material[]
    let imported = 0

    for (const row of validRows) {
      const existingMaterial = existing.find((m) => {
        if (m.catalog_source !== row.source) return false
        const sameSku = row.sku && m.sku && normalizeMaterialKey(row.sku) === normalizeMaterialKey(m.sku)
        const sameName = !row.sku && normalizeMaterialKey(row.name) === normalizeMaterialKey(m.name)
        return sameSku || sameName
      })

      const payload: MaterialPayload = {
        name: row.name,
        category: row.category,
        sku: row.sku,
        catalog_client_id: args.clientId,
        catalog_source: row.source,
        unit: row.unit,
        min_stock: 0,
        notes: row.notes,
        is_active: true,
      }

      const materialResult = existingMaterial
        ? await updateMaterial(existingMaterial.id, payload)
        : await createMaterial(payload)
      if (materialResult.error || !materialResult.data) {
        return { imported, error: materialResult.error ?? 'Material import failed' }
      }
      if (!existingMaterial) existing.push(materialResult.data)

      await addStock({
        vehicleId: args.vehicleId,
        materialId: materialResult.data.id,
        quantity: row.quantity,
        createdBy: args.createdBy,
        reason: `Import ${row.source.toUpperCase()} row ${row.rowNumber}`,
      })
      imported += 1
    }

    return { imported, error: null }
  } catch (err) {
    return { imported: 0, error: errorMessage(err) }
  }
}

export async function registerMaterialConsumption(args: {
  workOrderId: string
  vehicleId: string
  reportedBy: string
  drafts: ConsumptionDraft[]
}) {
  try {
    const drafts = args.drafts.filter((d) => d.material_id && d.quantity > 0)
    const materialMap = await fetchMaterialsByIds(drafts.map((d) => d.material_id))
    const corrections: ConsumptionCorrectionRequired[] = []

    for (const draft of drafts) {
      const stock = await findStock(args.vehicleId, draft.material_id)
      const registered = Number(stock?.quantity ?? 0)
      const result = applyConsumptionBalance(registered, draft.quantity, draft.stock_real_before)
      if (!result.ok && 'correctionRequired' in result) {
        const material = materialMap.get(draft.material_id)
        corrections.push({
          material_id: draft.material_id,
          material_name: material?.name ?? draft.material_id,
          requested: draft.quantity,
          registered,
          unit: material?.unit ?? '',
        })
      }
    }

    if (corrections.length > 0) {
      return { data: null, correctionRequired: corrections, error: 'STOCK_CORRECTION_REQUIRED' }
    }

    for (const draft of drafts) {
      const stock = await findStock(args.vehicleId, draft.material_id)
      const registered = Number(stock?.quantity ?? 0)
      const result = applyConsumptionBalance(registered, draft.quantity, draft.stock_real_before)
      if (!result.ok) {
        return {
          data: null,
          correctionRequired: [],
          error: 'error' in result ? result.error : 'Invalid consumption',
        }
      }

      if (result.correctionDelta !== 0) {
        await setStock({
          vehicleId: args.vehicleId,
          materialId: draft.material_id,
          quantity: result.stockBefore,
        })
        await insertStockMovement({
          vehicleId: args.vehicleId,
          materialId: draft.material_id,
          workOrderId: args.workOrderId,
          movementType: 'tech_correction',
          quantityDelta: result.correctionDelta,
          stockBefore: registered,
          stockAfter: result.stockBefore,
          reason: 'Technician stock correction before Rückmeldung',
          createdBy: args.reportedBy,
        })
      }

      await setStock({
        vehicleId: args.vehicleId,
        materialId: draft.material_id,
        quantity: result.stockAfter,
      })
      await insertStockMovement({
        vehicleId: args.vehicleId,
        materialId: draft.material_id,
        workOrderId: args.workOrderId,
        movementType: 'consumption',
        quantityDelta: -draft.quantity,
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
        reason: draft.notes ?? 'Rückmeldung material consumption',
        createdBy: args.reportedBy,
      })

      const { error } = await table('work_order_material_consumptions').insert({
        work_order_id: args.workOrderId,
        vehicle_id: args.vehicleId,
        material_id: draft.material_id,
        quantity: draft.quantity,
        reported_by: args.reportedBy,
        stock_real_before: draft.stock_real_before ?? null,
        notes: draft.notes ?? null,
      } as never)
      if (error) throw new Error(error.message)
    }

    return { data: true, correctionRequired: [], error: null }
  } catch (err) {
    return { data: null, correctionRequired: [], error: errorMessage(err) }
  }
}
