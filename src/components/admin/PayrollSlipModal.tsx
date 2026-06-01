import { useState, useMemo } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { generatePayrollPdf } from '@/services/pdfService'
import {
  calculatePayroll,
  formatEUR,
  formatPct,
  PAYROLL_YEAR,
  type PayrollInput,
} from '@/lib/payrollCalculation'
import type { Employee } from '@/services/employeeService'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function currentYearMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SlipRow({
  label,
  amount,
  sub = false,
  rate,
  bold = false,
  separator = false,
}: {
  label: string
  amount: number
  sub?: boolean
  rate?: string
  bold?: boolean
  separator?: boolean
}) {
  return (
    <>
      {separator && <tr><td colSpan={3} className="py-0"><div className="border-t border-gf-border" /></td></tr>}
      <tr>
        <td className={`py-1.5 ${sub ? 'pl-4' : ''}`}>
          <span className={`font-sans text-xs ${bold ? 'font-medium text-gf-text' : 'text-gf-text-muted'}`}>
            {label}
          </span>
        </td>
        {rate !== undefined ? (
          <td className="px-3 py-1.5 text-right">
            <span className="font-mono text-[11px] text-gf-text-muted">{rate}</span>
          </td>
        ) : (
          <td />
        )}
        <td className="py-1.5 text-right">
          <span className={`font-mono text-xs tabular-nums ${bold ? 'font-medium text-gf-text' : 'text-gf-text-muted'}`}>
            {formatEUR(amount)}
          </span>
        </td>
      </tr>
    </>
  )
}

// ── PayrollSlipModal ──────────────────────────────────────────────────────────

interface PayrollSlipModalProps {
  employee: Employee
  onClose: () => void
}

export function PayrollSlipModal({ employee, onClose }: PayrollSlipModalProps) {
  const { month: initMonth, year: initYear } = currentYearMonth()
  const [month, setMonth] = useState(initMonth)
  const [year, setYear] = useState(initYear)
  const [zusatzbeitrag, setZusatzbeitrag] = useState(1.7)

  const canCalculate =
    employee.steuerklasse !== null && employee.gross_salary > 0

  const result = useMemo(() => {
    if (!canCalculate || !employee.steuerklasse) return null
    const input: PayrollInput = {
      grossMonthly: employee.gross_salary,
      steuerklasse: employee.steuerklasse,
      zusatzbeitragKV: zusatzbeitrag,
    }
    return calculatePayroll(input)
  }, [employee.gross_salary, employee.steuerklasse, zusatzbeitrag, canCalculate])

  // Year options: current year ± 1
  const yearOptions = [initYear - 1, initYear, initYear + 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gf-base/80 p-4">
      <div className="flex w-full max-w-md flex-col rounded-gf-card border border-gf-border bg-gf-card">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gf-border px-5 py-4">
          <div>
            <h2 className="font-sans text-sm font-medium text-gf-text">Gehaltsabrechnung</h2>
            <p className="mt-0.5 font-mono text-xs text-gf-text-muted">{employee.full_name}</p>
          </div>
          <button onClick={onClose} className="text-gf-text-muted hover:text-gf-text">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 overflow-auto p-5">

          {/* Validation warning */}
          <div className="flex items-start gap-2 rounded-gf-card border border-gf-warning/30 bg-gf-warning/5 px-3 py-2">
            <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gf-warning" />
            <p className="font-sans text-[11px] text-gf-warning leading-relaxed">
              Berechnungen sind Näherungswerte (vereinfachte Formel 2024).
              Validierung durch <strong>Janet Martinez de Peglow</strong> erforderlich.
            </p>
          </div>

          {/* Period selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] text-gf-text-label">MONAT</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none"
              >
                {MONTHS_DE.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] text-gf-text-label">JAHR</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-sans text-sm text-gf-text focus:border-gf-primary focus:outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* KV Zusatzbeitrag */}
          <div>
            <label className="mb-1 block font-mono text-[10px] text-gf-text-label">
              KV ZUSATZBEITRAG (%) — Kassensatz gesamt
            </label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={zusatzbeitrag}
              onChange={(e) => setZusatzbeitrag(parseFloat(e.target.value) || 1.7)}
              className="w-full rounded-gf-btn border border-gf-border bg-gf-surface px-3 py-2 font-mono text-sm text-gf-text focus:border-gf-primary focus:outline-none"
            />
            <p className="mt-1 font-mono text-[10px] text-gf-text-muted">
              Arbeitnehmer zahlt die Hälfte — Standard 2024: 1,70 %
            </p>
          </div>

          {/* Missing data warning */}
          {!canCalculate && (
            <div className="rounded-gf-card border border-gf-accent/30 bg-gf-accent-light px-3 py-2">
              <p className="font-sans text-xs text-gf-accent">
                {!employee.steuerklasse
                  ? 'Steuerklasse fehlt — bitte im Mitarbeiterprofil ergänzen.'
                  : 'Bruttolohn ist 0 — bitte im Mitarbeiterprofil ergänzen.'}
              </p>
            </div>
          )}

          {/* Slip */}
          {result && (
            <div className="rounded-gf-card border border-gf-border">
              {/* Slip header */}
              <div className="border-b border-gf-border px-4 py-3">
                <p className="font-mono text-[10px] text-gf-text-label">LOHNABRECHNUNG</p>
                <p className="mt-0.5 font-sans text-xs text-gf-text">
                  {MONTHS_DE[month - 1]} {year} — Berechnungsbasis: {PAYROLL_YEAR}
                </p>
              </div>

              <div className="px-4 py-3">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="pb-2 text-left font-mono text-[10px] text-gf-text-label">POSITION</th>
                      <th className="pb-2 px-3 text-right font-mono text-[10px] text-gf-text-label">SATZ</th>
                      <th className="pb-2 text-right font-mono text-[10px] text-gf-text-label">BETRAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Gross */}
                    <SlipRow label="Bruttolohn" amount={result.grossMonthly} bold />

                    {/* SV */}
                    <SlipRow
                      label="Sozialversicherung (AN-Anteil)"
                      amount={-result.totalSV}
                      bold
                      separator
                    />
                    <SlipRow
                      label="Krankenversicherung"
                      amount={-result.kv}
                      sub
                      rate={formatPct(result.effectiveKVRate)}
                    />
                    <SlipRow
                      label="Pflegeversicherung"
                      amount={-result.pv}
                      sub
                      rate={formatPct(1.7)}
                    />
                    <SlipRow
                      label="Rentenversicherung"
                      amount={-result.rv}
                      sub
                      rate={formatPct(9.3)}
                    />
                    <SlipRow
                      label="Arbeitslosenversicherung"
                      amount={-result.av}
                      sub
                      rate={formatPct(1.3)}
                    />

                    {/* Tax */}
                    <SlipRow
                      label={`Lohnsteuer (SK ${employee.steuerklasse})`}
                      amount={-result.lohnsteuer}
                      bold
                      separator
                    />
                    {result.solidaritaetszuschlag > 0 && (
                      <SlipRow
                        label="Solidaritätszuschlag"
                        amount={-result.solidaritaetszuschlag}
                        sub
                        rate="5,50 %"
                      />
                    )}

                    {/* Net */}
                    <SlipRow
                      label="NETTOLOHN"
                      amount={result.netMonthly}
                      bold
                      separator
                    />
                  </tbody>
                </table>
              </div>

              {/* Net highlight */}
              <div className="flex items-center justify-between border-t border-gf-border bg-gf-base-light/40 px-4 py-3">
                <span className="font-sans text-xs font-medium text-gf-text">Auszahlungsbetrag</span>
                <span className="font-display text-lg font-bold text-gf-primary tabular-nums">
                  {formatEUR(result.netMonthly)}
                </span>
              </div>
            </div>
          )}

          {/* Employer cost note */}
          {result && (
            <div className="rounded-gf-card border border-gf-border px-4 py-3">
              <p className="font-mono text-[10px] text-gf-text-label mb-2">ARBEITGEBERKOSTEN (HINWEIS)</p>
              <div className="space-y-1">
                <CostRow label="Bruttolohn" value={formatEUR(result.grossMonthly)} />
                <CostRow label="AG-Anteil SV (ca.)" value={formatEUR(result.totalSV)} sub />
                <CostRow
                  label="Gesamtkosten AG (ca.)"
                  value={formatEUR(result.grossMonthly + result.totalSV)}
                  bold
                />
              </div>
              <p className="mt-2 font-mono text-[10px] text-gf-text-muted">
                AG-Anteil SV = gleicher Betrag wie AN-Anteil (Näherung). Berufsgenossenschaft nicht enthalten.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gf-border px-5 py-3">
          <button
            onClick={() => result && generatePayrollPdf(employee, result, month, year)}
            disabled={!result}
            className="flex items-center gap-2 rounded-gf-btn border border-gf-border px-4 py-2 font-sans text-sm text-gf-text-muted transition-colors hover:text-gf-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={13} strokeWidth={1.5} />
            PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-gf-btn border border-gf-border px-4 py-2 font-sans text-sm text-gf-text-muted hover:text-gf-text"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

function CostRow({
  label,
  value,
  sub = false,
  bold = false,
}: {
  label: string
  value: string
  sub?: boolean
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between ${sub ? 'pl-3' : ''}`}>
      <span className={`font-sans text-xs ${bold ? 'font-medium text-gf-text' : 'text-gf-text-muted'}`}>
        {label}
      </span>
      <span className={`font-mono text-xs tabular-nums ${bold ? 'font-medium text-gf-text' : 'text-gf-text-muted'}`}>
        {value}
      </span>
    </div>
  )
}
