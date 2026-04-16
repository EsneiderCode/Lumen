import type { WorkOrderStatus, WorkType, TeamColor } from '@/types/enums'

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  created: 'Erstellt',
  assigned: 'Zugewiesen',
  in_progress: 'In Bearbeitung',
  executed: 'Ausgeführt',
  rueckmeldung_pending: 'RM ausstehend',
  rueckmeldung_sent: 'RM gesendet',
  internally_certified: 'Int. zertifiziert',
  sent_to_client: 'An Kunden gesendet',
  client_accepted: 'Akzeptiert',
  client_rejected: 'Abgelehnt',
  invoiced: 'Fakturiert',
  paid: 'Bezahlt',
  returned: 'Zurückgegeben',
  cancelled: 'Storniert',
}

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  soplado: 'Soplado',
  fusion_ap: 'Fusión AP',
  fusion_dp: 'Fusión DP',
  alta: 'Alta',
  nt_installation: 'NT-Installation',
  patchkabel: 'Patchkabel',
}

export const PRIORITY_LABELS: Record<'normal' | 'alta' | 'urgente', string> = {
  normal: 'Normal',
  alta: 'Hoch',
  urgente: 'Dringend',
}

export const TEAM_LABELS: Record<TeamColor, string> = {
  rot: 'Rot',
  gruen: 'Grün',
  blau: 'Blau',
  gelb: 'Gelb',
}

export const DETAIL_FIELD_LABELS: Record<string, string> = {
  meters: 'Meter',
  section: 'Abschnitt',
  tube_diameter: 'Rohrdurchmesser',
  result: 'Ergebnis',
  splice_count: 'Spleiß-Anzahl',
  fiber_type: 'Fasertyp',
  fusion_losses: 'Schmelzverluste (dB)',
  has_measurement_cert: 'Meßprotokoll',
  access_type: 'Zugangstyp',
  equipment_installed: 'Eingebaute Geräte',
  client_signature: 'Kundenunterschrift',
  nt_type: 'NT-Typ',
  serial_number: 'Seriennummer',
  location: 'Standort',
  configuration: 'Konfiguration',
  connected_section: 'Verbundener Abschnitt',
  cable_length: 'Kabellänge (m)',
  connector_type: 'Steckertyp',
  test_result: 'Testergebnis',
}

export const PHOTO_LABELS: Record<'before' | 'during' | 'after', string> = {
  before: 'Vorher',
  during: 'Während',
  after: 'Nachher',
}
