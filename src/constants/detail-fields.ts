import type { WorkType } from '@/types/enums'

export interface DetailField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox'
  options?: string[]
  placeholder?: string
}

export const DETAIL_FIELDS: Record<WorkType, DetailField[]> = {
  soplado: [
    { key: 'meters', label: 'Meter', type: 'number', placeholder: '0' },
    { key: 'section', label: 'Abschnitt', type: 'text', placeholder: 'z.B. A1-B3' },
    { key: 'tube_diameter', label: 'Rohrdurchmesser', type: 'text', placeholder: 'z.B. 7/3.5' },
    { key: 'result', label: 'Ergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
  fusion_ap: [
    { key: 'cabinet_code', label: 'Schrank / Cabinet', type: 'text', placeholder: 'z.B. NE3-S-001 oder POP-X-12' },
    { key: 'card_count', label: 'Karten (nur POP)', type: 'number', placeholder: '0 = nicht anwendbar' },
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll vorhanden', type: 'checkbox' },
  ],
  fusion_dp: [
    { key: 'cabinet_code', label: 'Schrank / Cabinet', type: 'text', placeholder: 'z.B. NE3-S-001 oder POP-X-12' },
    { key: 'card_count', label: 'Karten (nur POP)', type: 'number', placeholder: '0 = nicht anwendbar' },
    { key: 'splice_count', label: 'Spleiß-Anzahl', type: 'number', placeholder: '0' },
    { key: 'fiber_type', label: 'Fasertyp', type: 'text', placeholder: 'z.B. G.657.A2' },
    { key: 'fusion_losses', label: 'Schmelzverluste (dB)', type: 'number', placeholder: '0.00' },
    { key: 'has_measurement_cert', label: 'Meßprotokoll vorhanden', type: 'checkbox' },
  ],
  alta: [
    {
      key: 'access_type',
      label: 'Zugangstyp',
      type: 'select',
      options: ['Keller', 'Erdgeschoss', 'Obergeschoss', 'Dach', 'Außen'],
    },
    { key: 'equipment_installed', label: 'Eingebaute Geräte', type: 'text', placeholder: 'z.B. NT-100, Splitter' },
    { key: 'client_signature', label: 'Kundenunterschrift vorhanden', type: 'checkbox' },
  ],
  nt_installation: [
    {
      key: 'nt_type',
      label: 'NT-Typ',
      type: 'select',
      options: ['NT-100', 'NT-200', 'NT-300', 'ONT', 'ONU'],
    },
    { key: 'serial_number', label: 'Seriennummer', type: 'text', placeholder: 'SN-XXXXXXXX' },
    { key: 'location', label: 'Standort', type: 'text', placeholder: 'z.B. Keller Raum 1' },
    { key: 'configuration', label: 'Konfiguration', type: 'text', placeholder: 'VLAN, IP…' },
  ],
  patchkabel: [
    { key: 'connected_section', label: 'Verbundener Abschnitt', type: 'text', placeholder: 'z.B. ODF-1 → ODF-2' },
    { key: 'cable_length', label: 'Kabellänge (m)', type: 'number', placeholder: '0' },
    {
      key: 'connector_type',
      label: 'Steckertyp',
      type: 'select',
      options: ['SC/APC', 'SC/UPC', 'LC/APC', 'LC/UPC', 'FC/APC'],
    },
    { key: 'test_result', label: 'Testergebnis', type: 'select', options: ['OK', 'NOK', 'Ausstehend'] },
  ],
  pop: [
    { key: 'rack_id', label: 'Rack-ID', type: 'text', placeholder: 'z.B. RACK-A-04' },
    { key: 'tray_count', label: 'Bandbahnen (Anzahl)', type: 'number', placeholder: '0' },
    {
      key: 'cable_entry_points',
      label: 'Kabel-Eingangspunkte',
      type: 'text',
      placeholder: 'z.B. Nord: 12 Kabel · Süd: 8 Kabel · Boden: 4 Kabel',
    },
  ],
}
