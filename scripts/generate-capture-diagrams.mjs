// Genera un diagrama por plan de captura a partir del plan REAL que corre en la
// app (src/constants/capture-plans.ts, el gemelo TypeScript de public.capture_plans).
//
// Por cada plan escribe en docs/capture-plans/:
//   <clave>.mmd         — fuente Mermaid (draw.io: Insertar → Avanzado → Mermaid)
//   <clave>.drawio.svg  — SVG que se ve en GitHub y en cualquier navegador Y que
//                         draw.io reabre para editar (lleva el modelo embebido)
//
// La idea es que NADIE redibuje a mano lo que ya existe en código: se genera, se
// abre en draw.io y encima se dibuja la variante que pide el cliente. Cuando esa
// variante llega a código, se vuelve a generar y el dibujo y la base de datos
// vuelven a coincidir.
//
// Uso: npm run diagrams:capture

import { createJiti } from 'jiti'
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'capture-plans')

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(ROOT, 'src') } })

// ── Etiquetas ────────────────────────────────────────────────────────────────
// Los planes guardan claves de i18n, no texto. Se resuelven contra el español,
// que es el idioma en el que se discuten los planes en oficina.

const locale = JSON.parse(await fs.readFile(path.join(ROOT, 'src/i18n/locales/es.json'), 'utf8'))

function label(key, fallback = '') {
  if (!key) return fallback
  const value = key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), locale)
  return typeof value === 'string' ? value : (fallback || key)
}

// ── Vocabulario del diagrama ─────────────────────────────────────────────────
// Cinco formas y nada más, para que cada dibujo se traduzca a plan de forma
// mecánica. Ver docs/capture-plans/README.md.

const SECTION_KIND_ES = {
  photos: 'fotos fijas',
  repeater: 'repetidor',
  gallery: 'galería libre',
  checklist: 'checklist',
  fields: 'datos',
}

const range = (min, max) => `${min}–${max == null ? '∞' : max}`

function fieldSuffix(field) {
  const parts = [field.type]
  if (field.required) parts.push('obligatorio')
  if (field.options?.length) parts.push(field.options.join(' / '))
  return parts.join(' · ')
}

const conditionText = (condition) => `solo si ${condition.path} = ${JSON.stringify(condition.equals)}`

function sectionRows(section) {
  const rows = []
  for (const slot of section.slots ?? []) {
    rows.push({
      shape: 'photo',
      text: `📷 ${label(slot.labelKey)}  [${range(slot.min, slot.max)}]`,
      hint: label(slot.hintKey, ''),
      condition: slot.condition ? conditionText(slot.condition) : null,
    })
  }
  for (const field of section.fields ?? []) {
    rows.push({
      shape: 'field',
      text: `${label(field.labelKey)}${field.required ? ' *' : ''}`,
      hint: fieldSuffix(field),
      condition: field.condition ? conditionText(field.condition) : null,
    })
  }
  return rows
}

function sectionHeader(section) {
  if (section.kind === 'repeater') {
    return `${label(section.titleKey)} — por cada ${label(section.itemLabelKey)} [${range(section.min, section.max)}]`
  }
  return `${label(section.titleKey)} — ${SECTION_KIND_ES[section.kind] ?? section.kind}`
}

const planTitle = (plan) =>
  `${label(plan.titleKey, plan.key)} — ${plan.key} v${plan.version}${plan.workType ? ` (tipo ${plan.workType})` : ''}`

const LEGEND =
  'Formas: columna = sección · rectángulo = slot de foto [mín–máx] · redondeado = campo · ' +
  'línea ámbar = condición · borde rojo discontinuo = repetidor. Generado del plan real: no editar el fichero a mano.'

// ── Layout ───────────────────────────────────────────────────────────────────
// Un solo cálculo de coordenadas alimenta el .drawio.svg y el modelo embebido,
// así el dibujo que se ve y el que se edita son exactamente el mismo.

const COL_W = 330
const COL_GAP = 34
const HEADER_H = 44
const ROW_H = 54
const COND_H = 24
const PAD = 12
const TOP = 118

// Tres columnas por fila: un plan de cinco secciones en línea da un lienzo de
// casi 1900 px que no se lee ni se imprime.
const MAX_COLS = 3

function layoutPlan(plan) {
  const sections = []
  let col = 0
  let x = 40
  let top = TOP
  let rowHeight = 0
  let maxBottom = TOP
  let maxRight = 0

  for (const section of plan.sections) {
    if (col === MAX_COLS) {
      col = 0
      x = 40
      top += rowHeight + 28
      rowHeight = 0
    }
    const rows = []
    let y = top + HEADER_H + PAD

    if (section.condition) {
      rows.push({ shape: 'condition', text: conditionText(section.condition), x: x + PAD, y, w: COL_W - PAD * 2, h: COND_H })
      y += COND_H + 6
    }

    for (const row of sectionRows(section)) {
      rows.push({ ...row, x: x + PAD, y, w: COL_W - PAD * 2, h: ROW_H })
      y += ROW_H + 6
      if (row.condition) {
        rows.push({ shape: 'condition', text: `⟡ ${row.condition}`, x: x + PAD + 14, y, w: COL_W - PAD * 2 - 14, h: COND_H })
        y += COND_H + 6
      }
    }

    const height = y - top + PAD - 6
    sections.push({ title: sectionHeader(section), repeater: section.kind === 'repeater', x, y: top, w: COL_W, h: height, rows })
    rowHeight = Math.max(rowHeight, height)
    maxBottom = Math.max(maxBottom, top + height)
    maxRight = Math.max(maxRight, x + COL_W)
    x += COL_W + COL_GAP
    col += 1
  }

  return { title: planTitle(plan), sections, width: maxRight + 40, height: maxBottom + 40 }
}

// ── draw.io (modelo mxGraph, sin comprimir) ──────────────────────────────────

const STYLE = {
  section: 'swimlane;html=1;whiteSpace=wrap;rounded=0;startSize=44;fillColor=#0E1014;strokeColor=#2E3440;fontColor=#F5F3EE;fontStyle=1;align=left;spacingLeft=10;verticalAlign=middle;',
  repeater: 'swimlane;html=1;whiteSpace=wrap;rounded=0;startSize=44;fillColor=#0E1014;strokeColor=#FF4D2E;dashed=1;fontColor=#F5F3EE;fontStyle=1;align=left;spacingLeft=10;verticalAlign=middle;',
  photo: 'rounded=0;html=1;whiteSpace=wrap;fillColor=#161920;strokeColor=#2E3440;fontColor=#F5F3EE;align=left;spacingLeft=8;verticalAlign=middle;',
  field: 'rounded=1;arcSize=20;html=1;whiteSpace=wrap;fillColor=#161920;strokeColor=#2E3440;fontColor=#B9BAB4;align=left;spacingLeft=8;verticalAlign=middle;',
  condition: 'rounded=0;html=1;whiteSpace=wrap;dashed=1;fillColor=none;strokeColor=#FFB020;fontColor=#FFB020;fontSize=10;align=left;spacingLeft=8;verticalAlign=middle;',
  title: 'text;html=1;whiteSpace=wrap;fontSize=20;fontStyle=1;fontColor=#F5F3EE;align=left;verticalAlign=middle;',
  legend: 'text;html=1;whiteSpace=wrap;fontSize=11;fontColor=#7B7D7A;align=left;verticalAlign=top;',
}

function xml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cell(id, value, style, geo, parent = '1') {
  return (
    `        <mxCell id="${id}" value="${xml(value)}" style="${style}" vertex="1" parent="${parent}">\n` +
    `          <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}" as="geometry" />\n` +
    '        </mxCell>'
  )
}

function toDrawioModel(plan, layout) {
  const cells = [
    cell('title', layout.title, STYLE.title, { x: 40, y: 28, w: layout.width - 80, h: 30 }),
    cell('legend', LEGEND, STYLE.legend, { x: 40, y: 62, w: layout.width - 80, h: 34 }),
  ]

  layout.sections.forEach((section, si) => {
    const sid = `s${si}`
    cells.push(
      cell(sid, section.title, section.repeater ? STYLE.repeater : STYLE.section, {
        x: section.x,
        y: section.y,
        w: section.w,
        h: section.h,
      }),
    )
    section.rows.forEach((row, ri) => {
      // Etiqueta HTML (html=1): el marcado entero se escapa en cell(), que es
      // como lo guarda draw.io. Las coordenadas van relativas a la columna.
      const value =
        row.shape === 'condition'
          ? row.text
          : row.hint
            ? `<b>${row.text}</b><br/><font style="font-size:10px;color:#7B7D7A">${row.hint}</font>`
            : `<b>${row.text}</b>`
      cells.push(
        cell(`${sid}_${ri}`, value, STYLE[row.shape], {
          x: row.x - section.x,
          y: row.y - section.y,
          w: row.w,
          h: row.h,
        }, sid),
      )
    })
  })

  return (
    '<mxfile host="LUMEN" type="device">\n' +
    `  <diagram id="${xml(plan.key)}" name="${xml(plan.key)}">\n` +
    `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" ` +
    `fold="1" page="1" pageScale="1" pageWidth="${layout.width}" pageHeight="${layout.height}" background="#07080A" math="0" shadow="0">\n` +
    '      <root>\n        <mxCell id="0" />\n        <mxCell id="1" parent="0" />\n' +
    cells.join('\n') +
    '\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n'
  )
}

// ── SVG ──────────────────────────────────────────────────────────────────────
// El `content` de la raíz lleva el modelo mxGraph: eso es lo que convierte un
// SVG normal en un fichero que draw.io reabre y reedita.

function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxChars && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else {
      line = candidate
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]
    const rest = words.join(' ')
    if (rest.length > lines.join(' ').length) lines[maxLines - 1] = `${last.slice(0, maxChars - 1)}…`
  }
  return lines
}

function svgText(x, y, text, { size = 12, color = '#F5F3EE', weight = 'normal' } = {}) {
  return `  <text x="${x}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(text)}</text>`
}

const ROW_FILL = { photo: '#161920', field: '#161920', condition: 'none' }
const ROW_STROKE = { photo: '#2E3440', field: '#2E3440', condition: '#FFB020' }

function toSvg(plan, layout, model) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" ` +
      `viewBox="0 0 ${layout.width} ${layout.height}" content="${xml(model)}">`,
    `  <rect width="${layout.width}" height="${layout.height}" fill="#07080A"/>`,
    svgText(40, 46, layout.title, { size: 20, weight: '700' }),
    ...wrap(LEGEND, 150, 2).map((line, i) => svgText(40, 74 + i * 15, line, { size: 11, color: '#7B7D7A' })),
  ]

  for (const section of layout.sections) {
    parts.push(
      `  <rect x="${section.x}" y="${section.y}" width="${section.w}" height="${section.h}" fill="#0E1014" ` +
        `stroke="${section.repeater ? '#FF4D2E' : '#2E3440'}"${section.repeater ? ' stroke-dasharray="6 4"' : ''}/>`,
      `  <line x1="${section.x}" y1="${section.y + HEADER_H}" x2="${section.x + section.w}" y2="${section.y + HEADER_H}" stroke="#2E3440"/>`,
      ...wrap(section.title, 42, 2).map((line, i) =>
        svgText(section.x + 10, section.y + (i === 0 ? 20 : 34), line, { size: 12, weight: '700' }),
      ),
    )

    for (const row of section.rows) {
      const rounded = row.shape === 'field' ? ' rx="6"' : ''
      const dashed = row.shape === 'condition' ? ' stroke-dasharray="4 3"' : ''
      parts.push(
        `  <rect x="${row.x}" y="${row.y}" width="${row.w}" height="${row.h}"${rounded} fill="${ROW_FILL[row.shape]}" stroke="${ROW_STROKE[row.shape]}"${dashed}/>`,
      )
      if (row.shape === 'condition') {
        parts.push(...wrap(row.text, 46, 1).map((line) => svgText(row.x + 8, row.y + 16, line, { size: 10, color: '#FFB020' })))
        continue
      }
      const titleLines = wrap(row.text, 40, 2)
      titleLines.forEach((line, i) => parts.push(svgText(row.x + 8, row.y + 18 + i * 14, line, { size: 12, weight: '600' })))
      if (row.hint) {
        const hintY = row.y + 18 + titleLines.length * 14
        wrap(row.hint, 48, 2 - (titleLines.length - 1)).forEach((line, i) =>
          parts.push(svgText(row.x + 8, hintY + i * 12, line, { size: 10, color: '#7B7D7A' })),
        )
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n') + '\n'
}

// ── Mermaid ──────────────────────────────────────────────────────────────────

// Mermaid rompe con comillas dentro de una etiqueta entrecomillada, y con
// corchetes/llaves porque delimitan la forma del nodo. Los paréntesis sí valen,
// y hacen falta: «Profundidad (cm)».
function mermaidEscape(text) {
  return String(text)
    .replace(/"/g, "'")
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

function toMermaid(plan) {
  const lines = [
    '%% Generado por scripts/generate-capture-diagrams.mjs — no editar a mano.',
    `%% Plan ${plan.key} v${plan.version}. Regenerar con: npm run diagrams:capture`,
    'flowchart TD',
    `  PLAN["${mermaidEscape(planTitle(plan))}"]`,
  ]

  plan.sections.forEach((section, si) => {
    const sid = `S${si}`
    lines.push(`  PLAN --> ${sid}{{"${mermaidEscape(sectionHeader(section))}"}}`)
    if (section.condition) {
      lines.push(`  ${sid} -.- ${sid}C["${mermaidEscape(conditionText(section.condition))}"]`)
    }
    sectionRows(section).forEach((row, ri) => {
      const id = `${sid}_${ri}`
      // `<small>` no lo pinta todo renderizador de Mermaid; `<br/>` sí.
      const text = mermaidEscape(row.hint ? `${row.text}<br/>· ${row.hint}` : row.text)
      const node = row.shape === 'photo' ? `${id}["${text}"]` : `${id}(["${text}"])`
      if (row.condition) {
        lines.push(`  ${sid} --> ${id}COND{"${mermaidEscape(row.condition)}"} --> ${node}`)
      } else {
        lines.push(`  ${sid} --> ${node}`)
      }
    })
  })

  return lines.join('\n') + '\n'
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { COMPILED_CAPTURE_PLANS } = await jiti.import('../src/constants/capture-plans.ts')

await fs.mkdir(OUT_DIR, { recursive: true })

const written = []
for (const [key, plan] of Object.entries(COMPILED_CAPTURE_PLANS)) {
  const layout = layoutPlan(plan)
  const model = toDrawioModel(plan, layout)
  await fs.writeFile(path.join(OUT_DIR, `${key}.mmd`), toMermaid(plan), 'utf8')
  await fs.writeFile(path.join(OUT_DIR, `${key}.drawio.svg`), toSvg(plan, layout, model), 'utf8')
  written.push(`${key} — v${plan.version}, ${plan.sections.length} secciones`)
}

console.log(`Diagramas en docs/capture-plans/:\n  - ${written.join('\n  - ')}`)
