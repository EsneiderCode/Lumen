// Excel export for the aggregate compliance reports (Fase 5b).

import ExcelJS from 'exceljs'
import type { ComplianceReports } from '@/services/complianceReportsService'

type TFunc = (key: string, opts?: Record<string, unknown>) => string

interface ExportOptions {
  t: TFunc
  locale: string
}

function localized(map: Record<string, string>, locale: string, fallback: string): string {
  return map[locale] ?? map.de ?? map.es ?? map.en ?? fallback
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Two-sheet workbook: expiring documents + aptitude portfolio. */
export async function exportComplianceReportsXlsx(
  reports: ComplianceReports,
  { t, locale }: ExportOptions,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LUMEN'
  workbook.created = new Date(reports.generatedAt)

  // ── Sheet 1: expiring documents ──────────────────────────────────────────
  const expSheet = workbook.addWorksheet(t('compliance.reports.expiringSheet'))
  const expHeaders = [
    t('compliance.dossier.colDocument'),
    t('compliance.reports.colEntity'),
    t('compliance.dossier.kind'),
    t('compliance.reports.colParent'),
    t('compliance.dossier.colStatus'),
    t('compliance.dossier.colExpires'),
    t('compliance.reports.colDaysLeft'),
  ]
  expSheet.addRow(expHeaders)
  for (const row of reports.expiring) {
    expSheet.addRow([
      localized(row.docName, locale, row.code),
      row.entityName,
      t(`compliance.kinds.${row.entityKind}`),
      row.parentName ?? '',
      t(`compliance.status.${row.status}`),
      row.expiresAt,
      row.daysLeft,
    ])
  }
  expSheet.columns = expHeaders.map((header) => ({ width: Math.max(header.length + 2, 16) }))
  expSheet.getRow(1).font = { bold: true }

  // ── Sheet 2: aptitude portfolio ──────────────────────────────────────────
  const portSheet = workbook.addWorksheet(t('compliance.reports.portfolioSheet'))
  const portHeaders = [
    t('compliance.reports.colEntity'),
    t('compliance.dossier.kind'),
    t('compliance.entity.country'),
    t('compliance.reports.colAptitude'),
    t('compliance.reports.colProblems'),
    t('compliance.reports.colWorkers'),
    t('compliance.reports.colExpiring'),
  ]
  portSheet.addRow(portHeaders)
  for (const row of reports.portfolio) {
    portSheet.addRow([
      row.entity.display_name,
      t(`compliance.kinds.${row.entity.kind}`),
      row.entity.country_code,
      t(`compliance.aptitude.${row.level}`),
      row.problemCount,
      row.workerCount,
      row.expiringCount,
    ])
  }
  portSheet.columns = portHeaders.map((header) => ({ width: Math.max(header.length + 2, 16) }))
  portSheet.getRow(1).font = { bold: true }

  const stamp = reports.generatedAt.slice(0, 10)
  await downloadWorkbook(workbook, `LUMEN_Compliance-Informe_${stamp}.xlsx`)
}
