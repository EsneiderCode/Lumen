import type { MaterialImportPreviewRow } from '@/types/material-inventory'

function str(v: unknown) {
  return String(v ?? '').trim()
}

function num(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const cleaned = str(v).replace(/\./g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeUnit(raw: unknown) {
  const value = str(raw)
  const lower = value.toLowerCase()
  if (!value) return 'ud'
  if (lower.includes('metro') || lower === 'm') return 'm'
  if (lower.includes('bobina') || lower.includes('rollo')) return 'rollo'
  if (lower.includes('caja')) return 'caja'
  if (lower.includes('unidad') || lower.includes('stk')) return 'ud'
  return value
}

export function normalizeMaterialKey(value: string | null) {
  return str(value).toLowerCase()
}

export function parseGfpRows(rows: unknown[][]): MaterialImportPreviewRow[] {
  const parsed: MaterialImportPreviewRow[] = []
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => str(cell).toLowerCase().includes('artikel number')) ||
    row.some((cell) => str(cell).toLowerCase().includes('material description')),
  )
  if (headerIndex < 0) return parsed

  for (let i = headerIndex + 2; i < rows.length; i++) {
    const row = rows[i] ?? []
    const category = str(row[1])
    const sku = str(row[2]) || null
    const name = str(row[3])
    const quantity = num(row[4])
    const notes = str(row[5]) || null
    const unit = normalizeUnit(row[6])

    if (!name && !sku) continue
    if (quantity <= 0) continue

    parsed.push({
      source: 'gfp',
      category: category || 'GlasfaserPlus',
      sku,
      name: name || sku || 'Material',
      unit,
      quantity,
      notes,
      rowNumber: i + 1,
      valid: Boolean(name || sku),
    })
  }
  return parsed
}

export function parseWestconnectRows(rows: unknown[][]): MaterialImportPreviewRow[] {
  const parsed: MaterialImportPreviewRow[] = []
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => str(cell).toLowerCase().includes('artikel nr')) &&
    row.some((cell) => str(cell).toLowerCase().includes('bestellmenge')),
  )
  if (headerIndex < 0) return parsed

  const headers = (rows[headerIndex] ?? []).map((cell) => str(cell).toLowerCase())
  const idxBaumappe = headers.findIndex((h) => h.includes('baumappe'))
  const idxInsyte = headers.findIndex((h) => h.includes('insyte') && !h.includes('artikel'))
  const idxSku = headers.findIndex((h) => h.includes('artikel nr'))
  const idxQty = headers.findIndex((h) => h.includes('bestellmenge'))

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const sku = str(row[idxSku]) || null
    const insyteName = str(row[idxInsyte])
    const baumappeName = str(row[idxBaumappe])
    const quantity = num(row[idxQty])
    const name = insyteName || baumappeName || sku || ''

    if (!name && !sku) continue
    if (quantity <= 0) continue

    parsed.push({
      source: 'westconnect',
      category: 'Westconnect',
      sku,
      name,
      unit: 'ud',
      quantity,
      notes: baumappeName && baumappeName !== name ? baumappeName : null,
      rowNumber: i + 1,
      valid: Boolean(name || sku),
    })
  }
  return parsed
}

export type ConsumptionBalanceResult =
  | {
      ok: true
      stockBefore: number
      stockAfter: number
      correctionDelta: number
    }
  | {
      ok: false
      correctionRequired: true
      registeredStock: number
    }
  | {
      ok: false
      error: string
    }

export function applyConsumptionBalance(
  registeredStock: number,
  requested: number,
  stockRealBefore?: number | null,
): ConsumptionBalanceResult {
  if (requested <= 0) return { ok: false, error: 'Quantity must be greater than 0' }
  const effectiveBefore = stockRealBefore ?? registeredStock
  if (registeredStock < requested && stockRealBefore == null) {
    return { ok: false, correctionRequired: true, registeredStock }
  }
  return {
    ok: true,
    stockBefore: effectiveBefore,
    stockAfter: effectiveBefore - requested,
    correctionDelta: stockRealBefore == null ? 0 : stockRealBefore - registeredStock,
  }
}
