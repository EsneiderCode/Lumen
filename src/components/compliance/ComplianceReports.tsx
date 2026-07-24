import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDown, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { fetchComplianceReports } from '@/services/complianceReportsService'
import type { ComplianceReports as Reports } from '@/services/complianceReportsService'
import { exportComplianceReportsXlsx } from '@/services/complianceReportsExport'
import { generateComplianceReportsPdf } from '@/services/pdfService'
import { DOT_CLASS } from '@/components/compliance/aptitudeLevel'
import type { AptitudeLevel } from '@/types/compliance'

const LEVEL_TEXT: Record<AptitudeLevel, string> = {
  green: 'text-ok',
  yellow: 'text-warn',
  red: 'text-err',
}

function localized(map: Record<string, string>, locale: string, fallback: string): string {
  return map[locale] ?? map.de ?? map.es ?? map.en ?? fallback
}

export function ComplianceReports() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.slice(0, 2)
  const [reports, setReports] = useState<Reports | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const { data, error: loadError } = await fetchComplianceReports()
    if (loadError) setError(loadError)
    setReports(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="nx-loader" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-l border border-err/30 bg-err/10 px-4 py-3 font-sans text-sm text-err">{error}</p>
    )
  }

  if (!reports) return null

  const s = reports.summary
  const kpis: Array<{ label: string; value: number; tone?: string }> = [
    { label: t('compliance.reports.kpiEntities'), value: s.entities },
    { label: t('compliance.aptitude.green'), value: s.green, tone: 'text-ok' },
    { label: t('compliance.aptitude.yellow'), value: s.yellow, tone: 'text-warn' },
    { label: t('compliance.aptitude.red'), value: s.red, tone: 'text-err' },
    { label: t('compliance.reports.kpiExpiringSoon'), value: s.expiringSoon, tone: 'text-warn' },
    { label: t('compliance.reports.kpiExpired'), value: s.expired, tone: 'text-err' },
  ]

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-fg-3">
          {t('compliance.reports.generatedAt')}: {new Date(reports.generatedAt).toLocaleString(locale === 'es' ? 'es-ES' : 'de-DE')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw size={13} strokeWidth={1.5} />
            {t('compliance.reports.refresh')}
          </button>
          <button
            type="button"
            onClick={() => void exportComplianceReportsXlsx(reports, { t, locale })}
            className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
          >
            <FileSpreadsheet size={13} strokeWidth={1.5} />
            {t('compliance.reports.exportExcel')}
          </button>
          <button
            type="button"
            onClick={() => generateComplianceReportsPdf(reports, { t, locale })}
            className="inline-flex items-center gap-1 rounded-s border border-line px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-accent hover:text-accent"
          >
            <FileDown size={13} strokeWidth={1.5} />
            {t('compliance.reports.exportPdf')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-l border border-line bg-bg-1 p-3">
            <p className={`font-display text-2xl font-bold ${kpi.tone ?? 'text-fg-1'}`}>{kpi.value}</p>
            <p className="mt-1 font-mono text-[10px] uppercase text-fg-3">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Expiring documents */}
      <div className="rounded-l border border-line">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-fg-1">
            {t('compliance.reports.expiringSection', { days: reports.windowDays })}
          </h3>
        </div>
        {reports.expiring.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-2">{t('compliance.reports.noExpiring')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.dossier.colDocument').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.reports.colEntity').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.reports.colParent').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.dossier.colStatus').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.dossier.colExpires').toUpperCase()}</th>
                  <th className="px-4 py-2 text-right font-mono text-xs text-fg-3">{t('compliance.reports.colDaysLeft').toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>
                {reports.expiring.map((row, index) => {
                  const expired = row.daysLeft < 0
                  return (
                    <tr key={`${row.entityId}-${row.code}-${index}`} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2 font-sans text-sm text-fg-1">{localized(row.docName, locale, row.code)}</td>
                      <td className="px-4 py-2 font-sans text-sm text-fg-2">{row.entityName}</td>
                      <td className="px-4 py-2 font-sans text-xs text-fg-3">{row.parentName ?? '—'}</td>
                      <td className={`px-4 py-2 font-mono text-xs ${expired ? 'text-err' : 'text-warn'}`}>
                        {t(`compliance.status.${row.status}`)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-fg-2">{row.expiresAt}</td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${expired ? 'text-err' : 'text-warn'}`}>
                        {expired ? t('compliance.reports.expiredBy', { days: Math.abs(row.daysLeft) }) : row.daysLeft}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Portfolio */}
      <div className="rounded-l border border-line">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-fg-1">{t('compliance.reports.portfolioSection')}</h3>
        </div>
        {reports.portfolio.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-2">{t('compliance.entitiesEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.reports.colEntity').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.dossier.kind').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.entity.country').toUpperCase()}</th>
                  <th className="px-4 py-2 text-left font-mono text-xs text-fg-3">{t('compliance.reports.colAptitude').toUpperCase()}</th>
                  <th className="px-4 py-2 text-right font-mono text-xs text-fg-3">{t('compliance.reports.colProblems').toUpperCase()}</th>
                  <th className="px-4 py-2 text-right font-mono text-xs text-fg-3">{t('compliance.reports.colWorkers').toUpperCase()}</th>
                  <th className="px-4 py-2 text-right font-mono text-xs text-fg-3">{t('compliance.reports.colExpiring').toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>
                {reports.portfolio.map((row) => (
                  <tr key={row.entity.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2 font-sans text-sm text-fg-1">{row.entity.display_name}</td>
                    <td className="px-4 py-2 font-sans text-xs text-fg-2">{t(`compliance.kinds.${row.entity.kind}`)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-2">{row.entity.country_code}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${LEVEL_TEXT[row.level]}`}>
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[row.level]}`} />
                        {t(`compliance.aptitude.${row.level}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-fg-2">{row.problemCount}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-fg-2">{row.workerCount}</td>
                    <td className={`px-4 py-2 text-right font-mono text-xs ${row.expiringCount > 0 ? 'text-warn' : 'text-fg-3'}`}>
                      {row.expiringCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
