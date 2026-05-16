import type { TeamColor } from './enums'
import type { Database } from './database.types'

export type Material = Database['public']['Tables']['materials']['Row']
export type MaterialInsert = Database['public']['Tables']['materials']['Insert']
export type MaterialUpdate = Database['public']['Tables']['materials']['Update']

export type InventoryVehicle = Database['public']['Tables']['inventory_vehicles']['Row']
export type InventoryVehicleInsert = Database['public']['Tables']['inventory_vehicles']['Insert']
export type InventoryVehicleUpdate = Database['public']['Tables']['inventory_vehicles']['Update']

export type VehicleMaterialStock = Database['public']['Tables']['vehicle_material_stock']['Row']
export type WorkOrderMaterialConsumption =
  Database['public']['Tables']['work_order_material_consumptions']['Row']
export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type StockMovementType = StockMovement['movement_type']

export interface ClientRef {
  id: string
  code: string
  name: string
}

export interface MaterialWithClient extends Material {
  clients?: ClientRef | null
}

export interface VehicleStockRow extends VehicleMaterialStock {
  material: Material
}

export interface VehicleStockSummary {
  vehicle: InventoryVehicle
  rows: VehicleStockRow[]
}

export interface MaterialImportPreviewRow {
  source: 'gfp' | 'westconnect' | 'manual'
  category: string
  sku: string | null
  name: string
  unit: string
  quantity: number
  notes: string | null
  rowNumber: number
  valid: boolean
  error?: string
}

export interface MaterialPayload {
  name: string
  category: string
  sku: string | null
  catalog_client_id: string
  catalog_source: string
  unit: string
  min_stock: number
  notes: string | null
  is_active: boolean
}

export interface VehiclePayload {
  name: string
  team: TeamColor
  license_plate: string | null
  notes: string | null
  active: boolean
}

export interface ConsumptionDraft {
  material_id: string
  quantity: number
  stock_real_before?: number | null
  notes?: string | null
}

export interface ConsumptionCorrectionRequired {
  material_id: string
  material_name: string
  requested: number
  registered: number
  unit: string
}
