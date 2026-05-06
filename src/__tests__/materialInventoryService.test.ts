import { describe, expect, it } from 'vitest'
import {
  applyConsumptionBalance,
  parseGfpRows,
  parseWestconnectRows,
} from '@/services/materialInventoryRules'

describe('material import parsers', () => {
  it('parses GlasfaserPlus rows from the Numbers export shape', () => {
    const rows = [
      ['', 'Type of material', 'Artikel Number', 'Material Description', 'Quantity', 'Comments', 'Unidad (Empaquetado)'],
      ['', 'Etiquetas de fila', 'Material', 'Texto breve de material', '', '', ''],
      ['', 'Activacion', 'GFM000453', 'GF-AP HÜP 4-8 WE GFP', 8, 'AP 4-8', 'Unidades'],
      ['', 'Latiguillos', 'GFM000360', 'PATCHKABEL G657A1 4,5M LCAPC-LCAPC', '', '', 'Unidades'],
    ]

    expect(parseGfpRows(rows)).toEqual([
      expect.objectContaining({
        source: 'gfp',
        category: 'Activacion',
        sku: 'GFM000453',
        name: 'GF-AP HÜP 4-8 WE GFP',
        quantity: 8,
        unit: 'ud',
      }),
    ])
  })

  it('parses Westconnect rows and ignores empty quantities', () => {
    const rows = [
      ['Nr.', 'Beizeichung Baumappe', 'Bezeichung Insyte', 'Artikel Nr. Insyte', 'Bestellmenge'],
      [1, 'Nokia ONT (Modem)', 'ONT (81074)', 'CED-GFM000017', ''],
      [7, 'Gf-TA mit Pigtail und Spleißablage', 'FTTH-ANSCHLUSSDOSE AP MIT SPLEIßABL. EON', 'GFM000535', 3],
    ]

    expect(parseWestconnectRows(rows)).toEqual([
      expect.objectContaining({
        source: 'westconnect',
        sku: 'GFM000535',
        name: 'FTTH-ANSCHLUSSDOSE AP MIT SPLEIßABL. EON',
        quantity: 3,
      }),
    ])
  })
})

describe('applyConsumptionBalance', () => {
  it('subtracts normal consumption from registered stock', () => {
    expect(applyConsumptionBalance(8, 3)).toEqual({
      ok: true,
      stockBefore: 8,
      stockAfter: 5,
      correctionDelta: 0,
    })
  })

  it('requires correction when requested consumption exceeds registered stock', () => {
    expect(applyConsumptionBalance(2, 5)).toEqual({
      ok: false,
      correctionRequired: true,
      registeredStock: 2,
    })
  })

  it('uses stock real before for technician corrections', () => {
    expect(applyConsumptionBalance(2, 5, 9)).toEqual({
      ok: true,
      stockBefore: 9,
      stockAfter: 4,
      correctionDelta: 7,
    })
  })
})
