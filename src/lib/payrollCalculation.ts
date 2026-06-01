/**
 * German payroll calculation — simplified 2024 values.
 *
 * ⚠ VALIDATION REQUIRED
 * These calculations are approximations based on publicly available German
 * tax law (EStG 2024, SGB V/VI/III). They MUST be validated by
 * Janet Martinez de Peglow before this module goes live in production.
 *
 * Simplifications made:
 * - KV Zusatzbeitrag defaults to the 2024 average (1.7 %).
 * - Pflegeversicherung: base rate 1.7 % (kinderlos-Zuschlag of 0.35 % not applied).
 * - Kirchensteuer not calculated.
 * - Steuerklasse V uses standard zone formula on full gross (no deductions).
 * - Steuerklasse VI uses a flat 42 % approximation.
 * - BBG values are for West Germany 2024.
 */

// ── 2024 constants ─────────────────────────────────────────────────────────────

/** Tax year these constants apply to. Update when rates change. */
export const PAYROLL_YEAR = 2024

const GRUNDFREIBETRAG = 11_784            // annual EUR
const ALLEINST_ENTLASTUNG = 4_260         // SK II — Entlastungsbetrag Alleinerziehende

const WERBUNGSKOSTEN_PAUSCHBETRAG = 1_230 // Arbeitnehmer-Pauschbetrag
const SONDERAUSGABEN_PAUSCHBETRAG = 36
const STANDARD_DEDUCTIONS = WERBUNGSKOSTEN_PAUSCHBETRAG + SONDERAUSGABEN_PAUSCHBETRAG // 1,266

/** BBG = Beitragsbemessungsgrenze (monthly, West 2024) */
const BBG_KV_PV = 5_175  // Kranken- und Pflegeversicherung
const BBG_RV_AV = 7_550  // Renten- und Arbeitslosenversicherung

/** Soli: Freigrenze on annual Lohnsteuer (SK I, 2024) */
const SOLI_FREIGRENZE = 18_130

// ── Lohnsteuer zone formula (EStG § 32a, 2024) ────────────────────────────────

/**
 * Computes annual Lohnsteuer for a given zvE (zu versteuerndes Einkommen)
 * using the standard SK I / SK IV zone formula (EStG § 32a 2024).
 * Returns the annual tax in EUR, floored to whole euros.
 */
function lohnsteuerZone(zvE: number): number {
  if (zvE <= 0) return 0

  if (zvE <= GRUNDFREIBETRAG) return 0

  if (zvE <= 17_005) {
    // Zone 2 — progressive 14 %–24 %
    const y = (zvE - GRUNDFREIBETRAG) / 10_000
    return Math.floor((979.18 * y + 1_400) * y)
  }

  if (zvE <= 66_760) {
    // Zone 3 — progressive 24 %–42 %
    const z = (zvE - 17_005) / 10_000
    return Math.floor((192.59 * z + 2_397) * z + 966)
  }

  if (zvE <= 277_825) {
    // Zone 4 — flat 42 %
    return Math.floor(0.42 * zvE - 9_972.98)
  }

  // Zone 5 — Reichensteuer 45 %
  return Math.floor(0.45 * zvE - 18_307.73)
}

/**
 * Annual Lohnsteuer for each Steuerklasse.
 * All results are annual EUR, floored to whole euros.
 */
function annualLohnsteuer(annualGross: number, sk: Employee['steuerklasse']): number {
  switch (sk) {
    case 'I':
    case 'IV': {
      const zvE = Math.max(0, annualGross - STANDARD_DEDUCTIONS)
      return lohnsteuerZone(zvE)
    }
    case 'II': {
      const zvE = Math.max(0, annualGross - STANDARD_DEDUCTIONS - ALLEINST_ENTLASTUNG)
      return lohnsteuerZone(zvE)
    }
    case 'III': {
      // Ehegattensplitting: compute on half zvE, double the result
      const zvE = Math.max(0, annualGross - STANDARD_DEDUCTIONS)
      return lohnsteuerZone(zvE / 2) * 2
    }
    case 'V': {
      // No Freibetrag, no standard deductions — simplified: zone formula on full gross
      return lohnsteuerZone(annualGross)
    }
    case 'VI': {
      // Second job — simplified flat 42 % (no exemptions)
      return Math.floor(annualGross * 0.42)
    }
    default:
      return 0
  }
}

// ── Public types ───────────────────────────────────────────────────────────────

interface Employee {
  steuerklasse: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null
}

export interface PayrollInput {
  /** Monthly gross salary (Bruttolohn) in EUR */
  grossMonthly: number
  /** German tax class */
  steuerklasse: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI'
  /** KV Zusatzbeitrag percentage (full rate, employee pays half). Default: 1.7 % */
  zusatzbeitragKV?: number
}

export interface PayrollResult {
  grossMonthly: number

  // Social insurance — Arbeitnehmeranteil (employee share)
  kv: number   // Krankenversicherung
  pv: number   // Pflegeversicherung
  rv: number   // Rentenversicherung
  av: number   // Arbeitslosenversicherung
  totalSV: number

  // Taxes
  lohnsteuer: number              // monthly
  solidaritaetszuschlag: number   // monthly (often 0 for lower incomes)

  // Result
  netMonthly: number

  // Rates used (for display/audit)
  effectiveKVRate: number  // base 7.3 % + half Zusatzbeitrag
  yearUsed: number
}

// ── Main calculation ───────────────────────────────────────────────────────────

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { grossMonthly, steuerklasse, zusatzbeitragKV = 1.7 } = input

  // ── Social insurance ──────────────────────────────────────────────────────

  const kvBase = Math.min(grossMonthly, BBG_KV_PV)
  const pvBase = Math.min(grossMonthly, BBG_KV_PV)
  const rvBase = Math.min(grossMonthly, BBG_RV_AV)
  const avBase = Math.min(grossMonthly, BBG_RV_AV)

  // Employee pays half of Zusatzbeitrag
  const effectiveKVRate = 7.3 + zusatzbeitragKV / 2  // e.g. 7.3 + 0.85 = 8.15 %

  const kv = round2(kvBase * (effectiveKVRate / 100))
  const pv = round2(pvBase * (1.7 / 100))
  const rv = round2(rvBase * (9.3 / 100))
  const av = round2(avBase * (1.3 / 100))
  const totalSV = round2(kv + pv + rv + av)

  // ── Lohnsteuer ────────────────────────────────────────────────────────────

  const annualGross = grossMonthly * 12
  const annualLSt = annualLohnsteuer(annualGross, steuerklasse)
  const lohnsteuer = round2(annualLSt / 12)

  // ── Solidaritätszuschlag (2024 — most employees pay 0) ────────────────────
  // Soli is 5.5 % of Lohnsteuer, but only if annual LSt > Freigrenze.
  // Sliding scale: full Soli above Freigrenze + 20 % of the difference band.

  let annualSoli = 0
  if (annualLSt > SOLI_FREIGRENZE) {
    const soli55 = annualLSt * 0.055
    // Sliding band: no cliff jump — Soli eases in over a range
    const slidingBandMax = (annualLSt - SOLI_FREIGRENZE) * 0.119
    annualSoli = Math.min(soli55, slidingBandMax)
    // If well above the sliding band, just take 5.5 %
    if (soli55 <= slidingBandMax) annualSoli = soli55
  }
  const solidaritaetszuschlag = round2(annualSoli / 12)

  const netMonthly = round2(grossMonthly - totalSV - lohnsteuer - solidaritaetszuschlag)

  return {
    grossMonthly,
    kv,
    pv,
    rv,
    av,
    totalSV,
    lohnsteuer,
    solidaritaetszuschlag,
    netMonthly,
    effectiveKVRate,
    yearUsed: PAYROLL_YEAR,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Format EUR for display */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Format a percentage rate for display */
export function formatPct(rate: number): string {
  return `${rate.toFixed(2).replace('.', ',')} %`
}
