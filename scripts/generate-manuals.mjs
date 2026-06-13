/**
 * generate-manuals.mjs
 *
 * Builds the LUMEN onboarding manuals as branded PDFs:
 *   - Manual del Colaborador Interno (ES)  -> técnicos / empleados HMR Nexus
 *   - Handbuch für Externe Mitarbeiter (DE) -> Subunternehmer / contractors
 *
 * Each manual ends with a read-confirmation page: a QR code that opens the
 * reader's mail app pre-filled with a "Lesebestätigung / Confirmación de
 * lectura" message addressed to ops. No backend required (mailto).
 *
 * Design follows the NEXUS Brand System "Print Metaphor": paper background
 * (--color-paper) + ink text (--color-ink) + accent (--color-accent). Printing
 * the dark-first app palette would waste ink and read poorly on paper.
 *
 * Run:  npm run manuals:generate
 * Out:  manuals/manual-interno-es.pdf, manuals/handbuch-extern-de.pdf
 */

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../manuals')

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
const VERSION = '1.0'
const ACK_EMAIL = 'info@hmr-nexus.com' // read-confirmation destination
const GENERATED_ON = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

// NEXUS Brand System — print metaphor tokens (src/index.css @theme)
const C = {
  paper: '#F5F3EE',
  ink: '#0A0B0D',
  accent: '#FF4D2E',
  fg2: '#6B6A63', // secondary ink on paper (derived for print legibility)
  fg3: '#8A8983',
  line: '#D9D5CC', // hairline on paper
  panel: '#ECE8DF', // callout fill on paper
  ok: '#2F9E5E',
  warn: '#B8801A',
}

// Page geometry (A4 portrait, mm)
const PAGE = { w: 210, h: 297, margin: 18 }
const CONTENT_W = PAGE.w - PAGE.margin * 2

// ----------------------------------------------------------------------------
// Low-level helpers
// ----------------------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
const setFill = (doc, hex) => doc.setFillColor(...hexToRgb(hex))
const setText = (doc, hex) => doc.setTextColor(...hexToRgb(hex))
const setDraw = (doc, hex) => doc.setDrawColor(...hexToRgb(hex))

/** Paint the full-page paper background. */
function paintPaper(doc) {
  setFill(doc, C.paper)
  doc.rect(0, 0, PAGE.w, PAGE.h, 'F')
}

/** Small typographic NEXUS·LUMEN wordmark (no real logo asset exists). */
function wordmark(doc, x, y, scale = 1) {
  doc.setFont('courier', 'bold')
  doc.setFontSize(9 * scale)
  setText(doc, C.ink)
  doc.text('NEXUS', x, y)
  const w = doc.getTextWidth('NEXUS')
  setText(doc, C.accent)
  doc.text('·', x + w + 1.2 * scale, y)
  const dotW = doc.getTextWidth('·')
  setText(doc, C.fg3)
  doc.text('LUMEN', x + w + dotW + 2.4 * scale, y)
}

// ----------------------------------------------------------------------------
// Page chrome (header / footer) and flowing content renderer
// ----------------------------------------------------------------------------
class Manual {
  constructor(meta) {
    this.meta = meta // { title, subtitle, role, roleLabel, lang }
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' })
    this.page = 0
    this.y = 0
  }

  newPage({ chrome = true } = {}) {
    if (this.page > 0) this.doc.addPage()
    this.page += 1
    paintPaper(this.doc)
    if (chrome) this._chrome()
    this.y = PAGE.margin + 8
  }

  _chrome() {
    const d = this.doc
    // header
    wordmark(d, PAGE.margin, PAGE.margin - 4)
    d.setFont('helvetica', 'normal')
    d.setFontSize(8)
    setText(d, C.fg3)
    d.text(this.meta.headerRight, PAGE.w - PAGE.margin, PAGE.margin - 4, {
      align: 'right',
    })
    setDraw(d, C.line)
    d.setLineWidth(0.2)
    d.line(PAGE.margin, PAGE.margin - 1, PAGE.w - PAGE.margin, PAGE.margin - 1)
    // footer
    setDraw(d, C.line)
    d.line(PAGE.margin, PAGE.h - PAGE.margin + 2, PAGE.w - PAGE.margin, PAGE.h - PAGE.margin + 2)
    d.setFontSize(7.5)
    setText(d, C.fg3)
    d.text(this.meta.footerLeft, PAGE.margin, PAGE.h - PAGE.margin + 7)
    d.text(String(this.page), PAGE.w - PAGE.margin, PAGE.h - PAGE.margin + 7, {
      align: 'right',
    })
  }

  /** Ensure `h` mm of vertical space remain, else break page. */
  ensure(h) {
    if (this.y + h > PAGE.h - PAGE.margin - 4) this.newPage()
  }

  // ---- block renderers ----
  h1(text) {
    this.ensure(16)
    const d = this.doc
    setFill(d, C.accent)
    d.rect(PAGE.margin, this.y - 3.5, 3, 7, 'F')
    d.setFont('helvetica', 'bold')
    d.setFontSize(16)
    setText(d, C.ink)
    d.text(text, PAGE.margin + 6, this.y + 2)
    this.y += 11
  }

  h2(text) {
    this.ensure(12)
    const d = this.doc
    d.setFont('helvetica', 'bold')
    d.setFontSize(11.5)
    setText(d, C.accent)
    d.text(text, PAGE.margin, this.y)
    this.y += 6.5
  }

  p(text) {
    const d = this.doc
    d.setFont('helvetica', 'normal')
    d.setFontSize(10)
    setText(d, C.ink)
    const lines = d.splitTextToSize(text, CONTENT_W)
    for (const line of lines) {
      this.ensure(6)
      d.text(line, PAGE.margin, this.y)
      this.y += 5.2
    }
    this.y += 2
  }

  /** Numbered steps: array of strings. */
  steps(items) {
    const d = this.doc
    items.forEach((item, i) => {
      d.setFont('courier', 'bold')
      d.setFontSize(10)
      setText(d, C.accent)
      const num = String(i + 1).padStart(2, '0')
      const indent = PAGE.margin + 9
      d.setFont('helvetica', 'normal')
      d.setFontSize(10)
      setText(d, C.ink)
      const lines = d.splitTextToSize(item, CONTENT_W - 9)
      this.ensure(lines.length * 5.2 + 1)
      d.setFont('courier', 'bold')
      setText(d, C.accent)
      d.text(num, PAGE.margin, this.y)
      d.setFont('helvetica', 'normal')
      setText(d, C.ink)
      lines.forEach((line, j) => {
        if (j > 0) this.ensure(5.2)
        d.text(line, indent, this.y)
        this.y += 5.2
      })
      this.y += 1.4
    })
    this.y += 1.5
  }

  /** Bullet list with accent dashes. */
  bullets(items) {
    const d = this.doc
    items.forEach((item) => {
      d.setFont('helvetica', 'normal')
      d.setFontSize(10)
      const lines = d.splitTextToSize(item, CONTENT_W - 6)
      this.ensure(lines.length * 5.2)
      setText(d, C.accent)
      d.setFont('helvetica', 'bold')
      d.text('—', PAGE.margin, this.y)
      d.setFont('helvetica', 'normal')
      setText(d, C.ink)
      lines.forEach((line, j) => {
        if (j > 0) this.ensure(5.2)
        d.text(line, PAGE.margin + 6, this.y)
        this.y += 5.2
      })
    })
    this.y += 2
  }

  /** Callout box: { tone: 'info'|'warn'|'ok', label, text }. */
  callout({ tone = 'info', label, text }) {
    const d = this.doc
    const accent = tone === 'warn' ? C.warn : tone === 'ok' ? C.ok : C.accent
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    const lines = d.splitTextToSize(text, CONTENT_W - 12)
    const boxH = lines.length * 4.8 + 12
    this.ensure(boxH + 2)
    setFill(d, C.panel)
    d.rect(PAGE.margin, this.y, CONTENT_W, boxH, 'F')
    setFill(d, accent)
    d.rect(PAGE.margin, this.y, 1.6, boxH, 'F')
    d.setFont('courier', 'bold')
    d.setFontSize(8)
    setText(d, accent)
    d.text(label.toUpperCase(), PAGE.margin + 6, this.y + 6)
    d.setFont('helvetica', 'normal')
    d.setFontSize(9.5)
    setText(d, C.ink)
    let yy = this.y + 11
    lines.forEach((line) => {
      d.text(line, PAGE.margin + 6, yy)
      yy += 4.8
    })
    this.y += boxH + 4
  }

  spacer(h = 3) {
    this.y += h
  }

  // ---- special pages ----
  cover() {
    this.newPage({ chrome: false })
    const d = this.doc
    const m = this.meta
    // top accent band
    setFill(d, C.accent)
    d.rect(0, 0, PAGE.w, 6, 'F')
    // wordmark
    wordmark(d, PAGE.margin, 34, 1.6)
    // role badge
    d.setFont('courier', 'bold')
    d.setFontSize(8.5)
    setText(d, C.paper)
    const badge = m.roleLabel.toUpperCase()
    d.setFontSize(8.5)
    const bw = d.getTextWidth(badge) + 10
    setFill(d, C.ink)
    d.rect(PAGE.margin, 118, bw, 9, 'F')
    setText(d, C.paper)
    d.text(badge, PAGE.margin + 5, 124)
    // title
    d.setFont('helvetica', 'bold')
    d.setFontSize(30)
    setText(d, C.ink)
    const titleLines = d.splitTextToSize(m.title, CONTENT_W)
    let ty = 145
    titleLines.forEach((line) => {
      d.text(line, PAGE.margin, ty)
      ty += 13
    })
    // accent rule
    setFill(d, C.accent)
    d.rect(PAGE.margin, ty + 1, 40, 1.6, 'F')
    // subtitle
    d.setFont('helvetica', 'normal')
    d.setFontSize(12)
    setText(d, C.fg2)
    const subLines = d.splitTextToSize(m.subtitle, CONTENT_W)
    let sy = ty + 12
    subLines.forEach((line) => {
      d.text(line, PAGE.margin, sy)
      sy += 6.5
    })
    // meta block (mono)
    d.setFont('courier', 'normal')
    d.setFontSize(9)
    setText(d, C.fg3)
    d.text(m.metaLines, PAGE.margin, 252, { lineHeightFactor: 1.6 })
    // bottom band
    setFill(d, C.ink)
    d.rect(0, PAGE.h - 14, PAGE.w, 14, 'F')
    d.setFont('helvetica', 'normal')
    d.setFontSize(8)
    setText(d, C.paper)
    d.text(m.footerBrand, PAGE.margin, PAGE.h - 5.5)
    d.text(`v${VERSION}`, PAGE.w - PAGE.margin, PAGE.h - 5.5, { align: 'right' })
  }

  async confirmationPage(t) {
    this.newPage()
    this.h1(t.ackTitle)
    this.p(t.ackIntro)

    // build mailto + QR
    const subject = encodeURIComponent(t.ackSubject)
    const body = encodeURIComponent(t.ackBody)
    const mailto = `mailto:${ACK_EMAIL}?subject=${subject}&body=${body}`
    const qrDataUrl = await QRCode.toDataURL(mailto, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: C.ink, light: C.paper },
      width: 600,
    })

    const d = this.doc
    const qrSize = 56
    const qrX = (PAGE.w - qrSize) / 2
    const qrY = this.y + 4
    // framed QR
    setDraw(d, C.line)
    d.setLineWidth(0.3)
    d.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8)
    d.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    this.y = qrY + qrSize + 10

    // caption
    d.setFont('courier', 'normal')
    d.setFontSize(8.5)
    setText(d, C.fg3)
    d.text(`› ${ACK_EMAIL}`, PAGE.w / 2, this.y, { align: 'center' })
    this.y += 8

    this.h2(t.ackHowTitle)
    this.steps(t.ackSteps)
    this.callout({ tone: 'warn', label: t.ackNoteLabel, text: t.ackNote })

    // manual sign-off lines (fallback if no smartphone)
    this.spacer(2)
    this.h2(t.ackManualTitle)
    const lineY = () => {
      this.ensure(14)
      setDraw(d, C.line)
      d.setLineWidth(0.3)
      d.line(PAGE.margin, this.y + 6, PAGE.margin + 80, this.y + 6)
      d.line(PAGE.w - PAGE.margin - 60, this.y + 6, PAGE.w - PAGE.margin, this.y + 6)
      d.setFont('helvetica', 'normal')
      d.setFontSize(8)
      setText(d, C.fg3)
    }
    lineY()
    d.text(t.ackFieldName, PAGE.margin, this.y + 10)
    d.text(t.ackFieldDate, PAGE.w - PAGE.margin - 60, this.y + 10)
    this.y += 18
    lineY()
    d.text(t.ackFieldSign, PAGE.margin, this.y + 10)
    d.text(t.ackFieldTeam, PAGE.w - PAGE.margin - 60, this.y + 10)
  }

  // render a list of content blocks
  render(blocks) {
    for (const b of blocks) {
      switch (b.t) {
        case 'h1':
          this.h1(b.x)
          break
        case 'h2':
          this.h2(b.x)
          break
        case 'p':
          this.p(b.x)
          break
        case 'steps':
          this.steps(b.x)
          break
        case 'bullets':
          this.bullets(b.x)
          break
        case 'callout':
          this.callout(b.x)
          break
        case 'spacer':
          this.spacer(b.x)
          break
        case 'pagebreak':
          this.newPage()
          break
      }
    }
  }

  save(filename) {
    mkdirSync(outDir, { recursive: true })
    const buf = Buffer.from(this.doc.output('arraybuffer'))
    const path = join(outDir, filename)
    writeFileSync(path, buf)
    return path
  }
}

// ----------------------------------------------------------------------------
// CONTENT — Manual Interno (Español) · técnicos / empleados
// ----------------------------------------------------------------------------
const internal = {
  meta: {
    title: 'Manual del Colaborador Interno',
    subtitle: 'Guía de uso de LUMEN para técnicos y personal de campo de HMR Nexus.',
    roleLabel: 'Colaborador interno',
    headerRight: 'Manual del Colaborador Interno',
    footerLeft: 'HMR Nexus Engineering GmbH · Documento interno · Confidencial',
    footerBrand: 'HMR Nexus Engineering GmbH · LUMEN',
    metaLines: [
      `Versión:    ${VERSION}`,
      `Generado:   ${GENERATED_ON}`,
      'Plataforma: LUMEN (PWA — web e instalable en móvil)',
      'Audiencia:  Técnicos y empleados internos',
    ].join('\n'),
  },
  blocks: [
    { t: 'h1', x: '1. Qué es LUMEN' },
    { t: 'p', x: 'LUMEN es la plataforma operativa central de HMR Nexus. Unifica la gestión de órdenes de servicio, los reportes de campo (Rückmeldung), la certificación de trabajos y la documentación del personal para los proyectos de fibra óptica (Glasfaser).' },
    { t: 'p', x: 'Como colaborador interno, usted utiliza LUMEN para ver sus órdenes asignadas, registrar el avance de su trabajo, cargar fotos de evidencia y enviar el Rückmeldung que permite certificar el trabajo ante el cliente.' },
    { t: 'callout', x: { tone: 'info', label: 'Funciona offline', text: 'LUMEN es una PWA: puede instalarla en el móvil y seguir trabajando sin señal. Los datos se sincronizan automáticamente cuando se recupera la conexión.' } },

    { t: 'h1', x: '2. Acceso a la app' },
    { t: 'h2', x: '2.1 Instalación en el móvil' },
    { t: 'steps', x: [
      'Abra el enlace de LUMEN en el navegador del móvil (Chrome en Android, Safari en iPhone).',
      'En el menú del navegador elija “Agregar a pantalla de inicio” / “Instalar app”.',
      'LUMEN queda como un ícono más. Ábrala desde ahí para tener pantalla completa y modo offline.',
    ] },
    { t: 'h2', x: '2.2 Inicio de sesión' },
    { t: 'p', x: 'Los técnicos ingresan con su PIN personal. El administrador le entrega el PIN la primera vez. No lo comparta: identifica todo lo que usted registra en el sistema.' },
    { t: 'callout', x: { tone: 'warn', label: 'PIN olvidado', text: 'Si olvidó su PIN o se bloqueó su acceso, contacte al administrador. Por seguridad, el PIN no se recupera por la app; se reasigna.' } },

    { t: 'h1', x: '3. Su día a día en LUMEN' },
    { t: 'h2', x: '3.1 Ver sus órdenes' },
    { t: 'p', x: 'Al ingresar verá su panel (Dashboard) con un resumen y el acceso a “Órdenes de trabajo”. Allí aparecen únicamente las órdenes asignadas a usted o a su equipo, con su estado y prioridad.' },
    { t: 'bullets', x: [
      'Toque una orden para ver el detalle: dirección, tipo de trabajo, datos del proyecto y la línea (NE3 / NE4).',
      'Revise los datos requeridos según el tipo de trabajo antes de salir a campo.',
    ] },
    { t: 'h2', x: '3.2 Tipos de trabajo y datos a registrar' },
    { t: 'p', x: 'Cada tipo de trabajo exige datos específicos. Téngalos a mano antes de cerrar la orden:' },
    { t: 'bullets', x: [
      'Soplado (NE3/NE4): metros, tramo, diámetro de tubo, resultado y fotos.',
      'Fusión AP/DP: cantidad de empalmes, tipo de fibra, pérdidas de fusión (dB) y certificado de medición.',
      'Alta / Instalación: dirección, tipo de acceso, equipo instalado, fotos antes/después y firma del cliente.',
      'Instalación NT: tipo de NT, número de serie, ubicación y configuración.',
      'Patchkabel: tramo conectado, longitud de cable, tipo de conector y resultado de la prueba.',
    ] },

    { t: 'h1', x: '4. Reportar el trabajo (Rückmeldung)' },
    { t: 'p', x: 'El Rückmeldung es el reporte de avance/finalización. Es el paso clave: sin un Rückmeldung completo, el trabajo NO se puede certificar internamente ni enviar al cliente.' },
    { t: 'steps', x: [
      'Entre a la orden ejecutada y abra el formulario de Rückmeldung.',
      'Complete los datos del tipo de trabajo (metros, empalmes, mediciones, etc.).',
      'Cargue las fotos de evidencia: claras, bien iluminadas y que muestren el trabajo realizado.',
      'Revise que no falte ningún campo obligatorio.',
      'Envíe el Rückmeldung. El estado de la orden avanza y queda disponible para certificación interna.',
    ] },
    { t: 'callout', x: { tone: 'ok', label: 'Buena práctica', text: 'Cargue las fotos en el momento, en campo. Si la red está caída, LUMEN las guarda y las sube sola al recuperar señal. No espere a la oficina.' } },
    { t: 'callout', x: { tone: 'warn', label: 'Regla de negocio', text: 'Rückmeldung incompleto › no hay certificación interna › no se envía al cliente › no se factura. Su reporte completo es lo que hace avanzar el cobro.' } },

    { t: 'h1', x: '5. Fotos y evidencia' },
    { t: 'bullets', x: [
      'Mínimo: una foto del estado inicial y una del trabajo terminado.',
      'En instalaciones (Alta/NT): foto del equipo, del número de serie y, si aplica, firma del cliente.',
      'Evite fotos borrosas, oscuras o que no identifiquen el punto de trabajo.',
    ] },

    { t: 'h1', x: '6. Estados de una orden' },
    { t: 'p', x: 'Una orden recorre este flujo. Saber dónde está le dice qué falta:' },
    { t: 'bullets', x: [
      'Creada › Asignada › En progreso › Ejecutada.',
      'Rückmeldung pendiente › Rückmeldung enviado › Certificada internamente.',
      'Enviada al cliente › Aceptada por el cliente › Facturada › Pagada.',
    ] },

    { t: 'h1', x: '7. Buenas prácticas y soporte' },
    { t: 'bullets', x: [
      'Sincronice apenas tenga señal: no deje reportes “colgados” en el móvil al final del día.',
      'No comparta su PIN. Cierre sesión en dispositivos compartidos.',
      'Ante cualquier duda o error de la app, avise al administrador con una captura de pantalla.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Soporte', text: `Dudas sobre LUMEN o su acceso: escriba a ${ACK_EMAIL} o contacte a su coordinador de equipo.` } },
  ],
  ack: {
    ackTitle: '8. Confirmación de lectura y recibido',
    ackIntro: 'Para dejar constancia de que leyó y recibió este manual, escanee el código QR con la cámara del móvil. Se abrirá su app de correo con un mensaje ya redactado: complete su nombre y equipo, y envíelo.',
    ackHowTitle: 'Cómo confirmar',
    ackSteps: [
      'Abra la cámara del móvil y apunte al código QR.',
      'Toque la notificación: se abre su app de correo con el mensaje pre-cargado.',
      'Complete su nombre, equipo y fecha en el cuerpo del correo.',
      'Envíe el correo. Listo: su lectura queda confirmada.',
    ],
    ackNoteLabel: 'Importante',
    ackNote: 'El correo se envía desde su propia cuenta. Si el QR no abre el correo, escriba manualmente a ' + ACK_EMAIL + ' con el asunto “Confirmación de lectura — Manual Colaborador Interno”.',
    ackManualTitle: 'Confirmación manual (alternativa)',
    ackFieldName: 'Nombre y apellido',
    ackFieldDate: 'Fecha',
    ackFieldSign: 'Firma',
    ackFieldTeam: 'Equipo',
    ackSubject: `Confirmación de lectura — Manual Colaborador Interno (v${VERSION})`,
    ackBody: `Confirmo que he leído y recibido el Manual del Colaborador Interno de LUMEN, versión ${VERSION}.\n\nNombre:\nEquipo:\nFecha:`,
  },
}

// ----------------------------------------------------------------------------
// CONTENT — Handbuch für Externe Mitarbeiter (Deutsch) · Subunternehmer
// ----------------------------------------------------------------------------
const external = {
  meta: {
    title: 'Handbuch für Externe Mitarbeiter',
    subtitle: 'Anleitung zur Nutzung von LUMEN für Subunternehmer und externe Partner von HMR Nexus.',
    roleLabel: 'Externer Mitarbeiter',
    headerRight: 'Handbuch · Externe Mitarbeiter',
    footerLeft: 'HMR Nexus Engineering GmbH · Vertraulich',
    footerBrand: 'HMR Nexus Engineering GmbH · LUMEN',
    metaLines: [
      `Version:    ${VERSION}`,
      `Erstellt:   ${GENERATED_ON}`,
      'Plattform:  LUMEN (PWA — Web und mobil installierbar)',
      'Zielgruppe: Subunternehmer / externe Partner',
    ].join('\n'),
  },
  blocks: [
    { t: 'h1', x: '1. Was ist LUMEN' },
    { t: 'p', x: 'LUMEN ist die zentrale Betriebsplattform von HMR Nexus für die Glasfaser-Infrastruktur. Sie bündelt Arbeitsaufträge, Rückmeldungen aus dem Feld, die Zertifizierung der Arbeiten und die Verwaltung der Mitarbeiterunterlagen.' },
    { t: 'p', x: 'Als externer Mitarbeiter nutzen Sie LUMEN, um Ihre zugewiesenen Aufträge einzusehen, Ihre Unterlagen aktuell zu halten und den Arbeitsfortschritt zu dokumentieren.' },
    { t: 'callout', x: { tone: 'info', label: 'Offline nutzbar', text: 'LUMEN ist eine PWA: Sie können die App auf dem Smartphone installieren und auch ohne Empfang weiterarbeiten. Die Daten werden automatisch synchronisiert, sobald wieder eine Verbindung besteht.' } },

    { t: 'h1', x: '2. Zugang zur App' },
    { t: 'h2', x: '2.1 Installation auf dem Smartphone' },
    { t: 'steps', x: [
      'Öffnen Sie den LUMEN-Link im Browser des Smartphones (Chrome bei Android, Safari bei iPhone).',
      'Wählen Sie im Browser-Menü „Zum Startbildschirm hinzufügen“ / „App installieren“.',
      'LUMEN erscheint als App-Symbol. Öffnen Sie sie von dort für Vollbild und Offline-Modus.',
    ] },
    { t: 'h2', x: '2.2 Anmeldung' },
    { t: 'p', x: 'Sie melden sich mit den von HMR Nexus bereitgestellten Zugangsdaten an. Geben Sie Ihre Zugangsdaten nicht weiter — alle Eingaben werden Ihrem Konto zugeordnet.' },

    { t: 'h1', x: '3. Ihre Unterlagen (Dokumente)' },
    { t: 'p', x: 'Dieser Bereich ist für externe Mitarbeiter besonders wichtig. Ohne vollständige und gültige Unterlagen wird die Zuweisung von Aufträgen automatisch gesperrt.' },
    { t: 'p', x: 'Im Bereich „Dokumente“ sehen Sie den Status jeder Unterlage und können neue Versionen hochladen. Erforderlich sind:' },
    { t: 'bullets', x: [
      'Gewerbeanmeldung',
      'Haftpflichtversicherung',
      'Unbedenklichkeitsbescheinigung (Finanzamt und Sozialkasse)',
      'Gültiger Ausweis / Reisepass',
      'Unterschriebener Subunternehmervertrag',
    ] },
    { t: 'callout', x: { tone: 'warn', label: 'Automatische Sperre', text: 'Fehlende oder abgelaufene Unterlagen › Auftragszuweisung gesperrt. Das System warnt automatisch, wenn ein Dokument in weniger als 30 Tagen abläuft. Laden Sie Erneuerungen rechtzeitig hoch.' } },
    { t: 'steps', x: [
      'Öffnen Sie den Bereich „Dokumente“.',
      'Prüfen Sie den Status und das Ablaufdatum jeder Unterlage.',
      'Laden Sie abgelaufene oder fehlende Dokumente als Foto oder PDF hoch.',
      'Warten Sie auf die Freigabe — danach sind wieder Zuweisungen möglich.',
    ] },

    { t: 'h1', x: '4. Aufträge bearbeiten' },
    { t: 'h2', x: '4.1 Aufträge ansehen' },
    { t: 'p', x: 'Im Bereich „Arbeitsaufträge“ sehen Sie ausschließlich die Ihnen zugewiesenen Aufträge mit Status und Priorität. Tippen Sie einen Auftrag an, um Details zu sehen: Adresse, Art der Arbeit, Projekt und Linie (NE3 / NE4).' },
    { t: 'h2', x: '4.2 Erforderliche Daten je Arbeitsart' },
    { t: 'bullets', x: [
      'Einblasen (NE3/NE4): Meter, Abschnitt, Rohrdurchmesser, Ergebnis und Fotos.',
      'Spleißung AP/DP: Anzahl der Spleiße, Fasertyp, Spleißverluste (dB) und Messprotokoll.',
      'Installation / Alta: Adresse, Zugangsart, installierte Geräte, Vorher-/Nachher-Fotos und Kundenunterschrift.',
      'NT-Installation: NT-Typ, Seriennummer, Standort und Konfiguration.',
      'Patchkabel: Verbundener Abschnitt, Kabellänge, Steckertyp und Testergebnis.',
    ] },

    { t: 'h1', x: '5. Rückmeldung' },
    { t: 'p', x: 'Die Rückmeldung ist die Fortschritts- bzw. Abschlussmeldung. Ohne vollständige Rückmeldung kann die Arbeit nicht zertifiziert und nicht an den Kunden weitergegeben werden.' },
    { t: 'steps', x: [
      'Öffnen Sie den ausgeführten Auftrag und das Rückmeldung-Formular.',
      'Tragen Sie die Daten der jeweiligen Arbeitsart ein (Meter, Spleiße, Messungen usw.).',
      'Laden Sie aussagekräftige Fotos als Nachweis hoch — scharf und gut beleuchtet.',
      'Prüfen Sie, dass kein Pflichtfeld fehlt.',
      'Senden Sie die Rückmeldung ab. Der Auftragsstatus wird aktualisiert.',
    ] },
    { t: 'callout', x: { tone: 'ok', label: 'Empfehlung', text: 'Laden Sie die Fotos direkt vor Ort hoch. Bei fehlendem Empfang speichert LUMEN sie und lädt sie automatisch hoch, sobald wieder Verbindung besteht.' } },

    { t: 'h1', x: '6. Fotos und Nachweise' },
    { t: 'bullets', x: [
      'Mindestens ein Foto des Ausgangszustands und eines der fertigen Arbeit.',
      'Bei Installationen: Foto des Geräts, der Seriennummer und ggf. Kundenunterschrift.',
      'Keine unscharfen oder dunklen Fotos, die den Arbeitspunkt nicht erkennen lassen.',
    ] },

    { t: 'h1', x: '7. Hinweise und Support' },
    { t: 'bullets', x: [
      'Halten Sie Ihre Unterlagen stets aktuell — das verhindert Sperren bei der Zuweisung.',
      'Synchronisieren Sie, sobald Empfang besteht; lassen Sie keine Meldungen offen.',
      'Geben Sie Ihre Zugangsdaten nicht weiter.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Support', text: `Fragen zu LUMEN, Ihrem Zugang oder Ihren Unterlagen: ${ACK_EMAIL} oder Ihr Ansprechpartner bei HMR Nexus.` } },
  ],
  ack: {
    ackTitle: '8. Lesebestätigung und Empfang',
    ackIntro: 'Um den Erhalt und das Lesen dieses Handbuchs zu bestätigen, scannen Sie den QR-Code mit der Kamera Ihres Smartphones. Ihre E-Mail-App öffnet sich mit einer vorbereiteten Nachricht: ergänzen Sie Name und Firma und senden Sie sie ab.',
    ackHowTitle: 'So bestätigen Sie',
    ackSteps: [
      'Öffnen Sie die Kamera des Smartphones und richten Sie sie auf den QR-Code.',
      'Tippen Sie auf die Benachrichtigung: Ihre E-Mail-App öffnet sich mit der vorbereiteten Nachricht.',
      'Ergänzen Sie Name, Firma und Datum im Text.',
      'Senden Sie die E-Mail ab. Ihre Lesebestätigung ist damit erfasst.',
    ],
    ackNoteLabel: 'Wichtig',
    ackNote: 'Die E-Mail wird von Ihrem eigenen Konto gesendet. Falls der QR-Code die E-Mail nicht öffnet, schreiben Sie manuell an ' + ACK_EMAIL + ' mit dem Betreff „Lesebestätigung — Handbuch Externe Mitarbeiter“.',
    ackManualTitle: 'Manuelle Bestätigung (Alternative)',
    ackFieldName: 'Vor- und Nachname',
    ackFieldDate: 'Datum',
    ackFieldSign: 'Unterschrift',
    ackFieldTeam: 'Firma',
    ackSubject: `Lesebestätigung — Handbuch Externe Mitarbeiter (v${VERSION})`,
    ackBody: `Hiermit bestätige ich, das Handbuch für externe Mitarbeiter von LUMEN (Version ${VERSION}) gelesen und erhalten zu haben.\n\nName:\nFirma:\nDatum:`,
  },
}

// ----------------------------------------------------------------------------
// CONTENT — Manual del Colaborador Externo (Español) · subcontratistas
// ----------------------------------------------------------------------------
const externalEs = {
  meta: {
    title: 'Manual del Colaborador Externo',
    subtitle: 'Guía de uso de LUMEN para subcontratistas y colaboradores externos de HMR Nexus.',
    roleLabel: 'Colaborador externo',
    headerRight: 'Manual del Colaborador Externo',
    footerLeft: 'HMR Nexus Engineering GmbH · Documento para colaboradores externos · Confidencial',
    footerBrand: 'HMR Nexus Engineering GmbH · LUMEN',
    metaLines: [
      `Versión:    ${VERSION}`,
      `Generado:   ${GENERATED_ON}`,
      'Plataforma: LUMEN (PWA — web e instalable en móvil)',
      'Audiencia:  Subcontratistas / colaboradores externos',
    ].join('\n'),
  },
  blocks: [
    { t: 'h1', x: '1. Qué es LUMEN' },
    { t: 'p', x: 'LUMEN es la plataforma operativa central de HMR Nexus para la infraestructura de fibra óptica (Glasfaser). Reúne las órdenes de trabajo, los reportes de campo (Rückmeldung), la certificación de los trabajos y la gestión de la documentación del personal.' },
    { t: 'p', x: 'Como colaborador externo, usted utiliza LUMEN para ver sus órdenes asignadas, mantener su documentación al día y documentar el avance de su trabajo.' },
    { t: 'callout', x: { tone: 'info', label: 'Funciona offline', text: 'LUMEN es una PWA: puede instalarla en el móvil y seguir trabajando sin señal. Los datos se sincronizan automáticamente al recuperar la conexión.' } },

    { t: 'h1', x: '2. Acceso a la app' },
    { t: 'h2', x: '2.1 Instalación en el móvil' },
    { t: 'steps', x: [
      'Abra el enlace de LUMEN en el navegador del móvil (Chrome en Android, Safari en iPhone).',
      'En el menú del navegador elija “Agregar a pantalla de inicio” / “Instalar app”.',
      'LUMEN queda como un ícono más. Ábrala desde ahí para pantalla completa y modo offline.',
    ] },
    { t: 'h2', x: '2.2 Inicio de sesión' },
    { t: 'p', x: 'Ingrese con las credenciales que le entrega HMR Nexus. No las comparta: todo lo que registre queda asociado a su cuenta.' },

    { t: 'h1', x: '3. Su documentación (Dokumente)' },
    { t: 'p', x: 'Esta sección es la más importante para los colaboradores externos. Sin documentación completa y vigente, la asignación de órdenes se bloquea automáticamente.' },
    { t: 'p', x: 'En la sección “Documentos” ve el estado de cada documento y puede subir nuevas versiones. Se requieren:' },
    { t: 'bullets', x: [
      'Gewerbeanmeldung (registro de actividad comercial)',
      'Haftpflichtversicherung (seguro de responsabilidad civil)',
      'Unbedenklichkeitsbescheinigung (Finanzamt y Sozialkasse)',
      'Documento de identidad / pasaporte vigente',
      'Contrato de subcontratación firmado',
    ] },
    { t: 'callout', x: { tone: 'warn', label: 'Bloqueo automático', text: 'Documentación faltante o vencida › asignación de órdenes bloqueada. El sistema avisa automáticamente cuando un documento vence en menos de 30 días. Suba las renovaciones a tiempo.' } },
    { t: 'steps', x: [
      'Abra la sección “Documentos”.',
      'Revise el estado y la fecha de vencimiento de cada documento.',
      'Suba los documentos vencidos o faltantes como foto o PDF.',
      'Espere la aprobación: después vuelve a poder recibir asignaciones.',
    ] },

    { t: 'h1', x: '4. Trabajar las órdenes' },
    { t: 'h2', x: '4.1 Ver sus órdenes' },
    { t: 'p', x: 'En “Órdenes de trabajo” ve únicamente las órdenes asignadas a usted, con su estado y prioridad. Toque una orden para ver el detalle: dirección, tipo de trabajo, proyecto y línea (NE3 / NE4).' },
    { t: 'h2', x: '4.2 Datos requeridos según el tipo de trabajo' },
    { t: 'bullets', x: [
      'Soplado (NE3/NE4): metros, tramo, diámetro de tubo, resultado y fotos.',
      'Fusión AP/DP: cantidad de empalmes, tipo de fibra, pérdidas de fusión (dB) y certificado de medición.',
      'Alta / Instalación: dirección, tipo de acceso, equipo instalado, fotos antes/después y firma del cliente.',
      'Instalación NT: tipo de NT, número de serie, ubicación y configuración.',
      'Patchkabel: tramo conectado, longitud de cable, tipo de conector y resultado de la prueba.',
    ] },

    { t: 'h1', x: '5. Reportar el trabajo (Rückmeldung)' },
    { t: 'p', x: 'El Rückmeldung es el reporte de avance/finalización. Sin un Rückmeldung completo, el trabajo no se puede certificar ni enviar al cliente.' },
    { t: 'steps', x: [
      'Abra la orden ejecutada y el formulario de Rückmeldung.',
      'Complete los datos del tipo de trabajo (metros, empalmes, mediciones, etc.).',
      'Cargue fotos de evidencia claras y bien iluminadas.',
      'Revise que no falte ningún campo obligatorio.',
      'Envíe el Rückmeldung. El estado de la orden se actualiza.',
    ] },
    { t: 'callout', x: { tone: 'ok', label: 'Recomendación', text: 'Cargue las fotos en campo, en el momento. Si no hay señal, LUMEN las guarda y las sube sola al recuperar la conexión.' } },

    { t: 'h1', x: '6. Fotos y evidencia' },
    { t: 'bullets', x: [
      'Mínimo: una foto del estado inicial y una del trabajo terminado.',
      'En instalaciones: foto del equipo, del número de serie y, si aplica, firma del cliente.',
      'Evite fotos borrosas u oscuras que no identifiquen el punto de trabajo.',
    ] },

    { t: 'h1', x: '7. Avisos y soporte' },
    { t: 'bullets', x: [
      'Mantenga su documentación siempre al día: evita bloqueos en la asignación.',
      'Sincronice apenas tenga señal; no deje reportes sin enviar.',
      'No comparta sus credenciales.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Soporte', text: `Dudas sobre LUMEN, su acceso o su documentación: ${ACK_EMAIL} o su contacto en HMR Nexus.` } },
  ],
  ack: {
    ackTitle: '8. Confirmación de lectura y recibido',
    ackIntro: 'Para dejar constancia de que leyó y recibió este manual, escanee el código QR con la cámara del móvil. Se abrirá su app de correo con un mensaje ya redactado: complete su nombre y empresa, y envíelo.',
    ackHowTitle: 'Cómo confirmar',
    ackSteps: [
      'Abra la cámara del móvil y apunte al código QR.',
      'Toque la notificación: se abre su app de correo con el mensaje pre-cargado.',
      'Complete su nombre, empresa y fecha en el cuerpo del correo.',
      'Envíe el correo. Listo: su lectura queda confirmada.',
    ],
    ackNoteLabel: 'Importante',
    ackNote: 'El correo se envía desde su propia cuenta. Si el QR no abre el correo, escriba manualmente a ' + ACK_EMAIL + ' con el asunto “Confirmación de lectura — Manual Colaborador Externo”.',
    ackManualTitle: 'Confirmación manual (alternativa)',
    ackFieldName: 'Nombre y apellido',
    ackFieldDate: 'Fecha',
    ackFieldSign: 'Firma',
    ackFieldTeam: 'Empresa',
    ackSubject: `Confirmación de lectura — Manual Colaborador Externo (v${VERSION})`,
    ackBody: `Confirmo que he leído y recibido el Manual del Colaborador Externo de LUMEN, versión ${VERSION}.\n\nNombre:\nEmpresa:\nFecha:`,
  },
}

// ----------------------------------------------------------------------------
// CONTENT — Manual del Administrador (Español)
// ----------------------------------------------------------------------------
const admin = {
  meta: {
    title: 'Manual del Administrador',
    subtitle: 'Gestión completa de LUMEN: proyectos, órdenes, certificación, personal y materiales.',
    roleLabel: 'Administrador',
    headerRight: 'Manual del Administrador',
    footerLeft: 'HMR Nexus Engineering GmbH · Documento interno · Confidencial',
    footerBrand: 'HMR Nexus Engineering GmbH · LUMEN',
    metaLines: [
      `Versión:    ${VERSION}`,
      `Generado:   ${GENERATED_ON}`,
      'Plataforma: LUMEN (panel web de administración)',
      'Audiencia:  Administradores y coordinación',
    ].join('\n'),
  },
  blocks: [
    { t: 'h1', x: '1. El panel de administración' },
    { t: 'p', x: 'Como administrador, usted gestiona todo el ciclo operativo de HMR Nexus en LUMEN: proyectos, órdenes de servicio, asignaciones, certificación dual, personal interno y externo, materiales y catálogo de servicios.' },
    { t: 'p', x: 'El acceso de administrador es por correo electrónico y contraseña (los técnicos y externos usan otros métodos). Desde el panel ve el menú lateral con todas las áreas de gestión.' },
    { t: 'callout', x: { tone: 'warn', label: 'Responsabilidad', text: 'El perfil de administrador puede crear y asignar órdenes, certificar y gestionar personal. Cuide sus credenciales y cierre sesión en equipos compartidos.' } },

    { t: 'h1', x: '2. Dashboard ejecutivo' },
    { t: 'p', x: 'El Dashboard muestra los KPIs y el estado general: órdenes por estado, rendimiento de los equipos (Rot, Grün, Blau, Gelb) y proyectos activos. Úselo como punto de partida para detectar cuellos de botella.' },

    { t: 'h1', x: '3. Proyectos' },
    { t: 'p', x: 'Cada orden pertenece a un proyecto. Los proyectos definen valores por defecto que luego se heredan al crear órdenes: cliente, operador (DGF, GFP, UGG) y línea (NE3 / NE4).' },
    { t: 'steps', x: [
      'Entre a “Proyectos” y cree o abra un proyecto.',
      'Defina cliente, operador y línea por defecto.',
      'Al crear una orden desde ese proyecto, esos valores se derivan automáticamente.',
    ] },

    { t: 'h1', x: '4. Órdenes de servicio' },
    { t: 'h2', x: '4.1 Crear una orden' },
    { t: 'steps', x: [
      'Entre a “Órdenes de trabajo” y elija “Nueva orden”.',
      'Seleccione el proyecto: cliente, operador y línea se derivan solos.',
      'Complete tipo de trabajo, dirección y datos específicos requeridos.',
      'Guarde la orden: queda en estado “Creada”.',
    ] },
    { t: 'h2', x: '4.2 Tipos de trabajo' },
    { t: 'bullets', x: [
      'Soplado (NE3/NE4), Fusión AP/DP, Alta/Instalación, Instalación NT, Patchkabel.',
      'Cada tipo exige datos propios (metros, empalmes, dB, números de serie, etc.).',
    ] },

    { t: 'h1', x: '5. Asignación de órdenes' },
    { t: 'p', x: 'Desde el detalle de una orden, la asigna a un técnico/equipo interno o a un colaborador externo. La asignación respeta reglas de negocio.' },
    { t: 'callout', x: { tone: 'warn', label: 'Bloqueo por documentación', text: 'Un colaborador externo con documentación incompleta o vencida NO puede recibir asignaciones. El sistema lo bloquea automáticamente y avisa de documentos por vencer (< 30 días).' } },

    { t: 'h1', x: '6. Certificación dual' },
    { t: 'p', x: 'LUMEN maneja dos niveles de certificación encadenados: primero la certificación interna (Nexus), luego el envío y aceptación del cliente.' },
    { t: 'bullets', x: [
      'Sin Rückmeldung completo › no se puede certificar internamente.',
      'Sin certificación interna › no se puede enviar al cliente.',
      'Sin aceptación del cliente › no se puede facturar.',
    ] },
    { t: 'steps', x: [
      'En “Certificación” revise las órdenes con Rückmeldung enviado.',
      'Verifique datos y fotos; certifique internamente (Nexus).',
      'Envíe al cliente. Al aceptar, la orden queda lista para facturar.',
    ] },

    { t: 'h1', x: '7. Personal y usuarios' },
    { t: 'h2', x: '7.1 Empleados internos (ley alemana)' },
    { t: 'bullets', x: [
      'Datos de nómina (Gehaltsabrechnung), vacaciones (mínimo 20 días BUrlG), clase de impuesto (Steuerklasse I–VI).',
      'SV-Nummer (seguridad social) y Steuer-ID requeridos.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Validación pendiente', text: 'Los cálculos de nómina deben ser validados por la asesora fiscal (Janet Martinez de Peglow) antes de operar el módulo de RR.HH.' } },
    { t: 'h2', x: '7.2 Colaboradores externos' },
    { t: 'p', x: 'Gestione su documentación (Gewerbeanmeldung, seguro, Unbedenklichkeitsbescheinigung, ID, contrato). El sistema alerta y bloquea por documentos vencidos.' },
    { t: 'h2', x: '7.3 Usuarios y accesos' },
    { t: 'p', x: 'En “Usuarios” crea cuentas y asigna el rol (administrador, técnico, colaborador externo). A los técnicos se les asigna un PIN de acceso; al administrador, correo y contraseña.' },

    { t: 'h1', x: '8. Materiales y catálogo' },
    { t: 'bullets', x: [
      'Control de materiales: inventario por equipo / vehículo.',
      'Catálogo de servicios: defina los ítems y categorías de trabajo disponibles para las órdenes.',
    ] },

    { t: 'h1', x: '9. Flujo de estados de una orden' },
    { t: 'bullets', x: [
      'Creada › Asignada › En progreso › Ejecutada.',
      'Rückmeldung pendiente › Rückmeldung enviado › Certificada internamente.',
      'Enviada al cliente › Aceptada › Facturada › Pagada.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Soporte', text: `Dudas de configuración o incidencias de la plataforma: ${ACK_EMAIL}.` } },
  ],
  ack: {
    ackTitle: '10. Confirmación de lectura y recibido',
    ackIntro: 'Para dejar constancia de que leyó y recibió este manual, escanee el código QR con la cámara del móvil. Se abrirá su app de correo con un mensaje ya redactado: complete su nombre y envíelo.',
    ackHowTitle: 'Cómo confirmar',
    ackSteps: [
      'Abra la cámara del móvil y apunte al código QR.',
      'Toque la notificación: se abre su app de correo con el mensaje pre-cargado.',
      'Complete su nombre, área y fecha en el cuerpo del correo.',
      'Envíe el correo. Listo: su lectura queda confirmada.',
    ],
    ackNoteLabel: 'Importante',
    ackNote: 'El correo se envía desde su propia cuenta. Si el QR no abre el correo, escriba manualmente a ' + ACK_EMAIL + ' con el asunto “Confirmación de lectura — Manual de Administrador”.',
    ackManualTitle: 'Confirmación manual (alternativa)',
    ackFieldName: 'Nombre y apellido',
    ackFieldDate: 'Fecha',
    ackFieldSign: 'Firma',
    ackFieldTeam: 'Área / rol',
    ackSubject: `Confirmación de lectura — Manual de Administrador (v${VERSION})`,
    ackBody: `Confirmo que he leído y recibido el Manual del Administrador de LUMEN, versión ${VERSION}.\n\nNombre:\nÁrea:\nFecha:`,
  },
}

// ----------------------------------------------------------------------------
// CONTENT — Manual del perfil "Citas NE3 (DGF)" (Español)
// Gestión de citas / Termine de la línea NE3 para el operador DGF.
// ----------------------------------------------------------------------------
const citasNe3 = {
  meta: {
    title: 'Manual del perfil Citas NE3 (DGF)',
    subtitle: 'Gestión de citas / Termine de la línea NE3 para el operador DGF en LUMEN.',
    roleLabel: 'Citas NE3 · DGF',
    headerRight: 'Manual Citas NE3 (DGF)',
    footerLeft: 'HMR Nexus Engineering GmbH · Documento interno · Confidencial',
    footerBrand: 'HMR Nexus Engineering GmbH · LUMEN',
    metaLines: [
      `Versión:    ${VERSION}`,
      `Generado:   ${GENERATED_ON}`,
      'Plataforma: LUMEN (panel web — gestión de citas)',
      'Audiencia:  Coordinación de citas NE3 / operador DGF',
    ].join('\n'),
  },
  blocks: [
    { t: 'h1', x: '1. Su perfil en LUMEN' },
    { t: 'p', x: 'Con su perfil de Citas NE3 (DGF), usted gestiona en LUMEN las citas (Termine) de la línea NE3 para el operador DGF. Su pantalla principal es la agenda de citas, desde donde organiza y da seguimiento a cada cita.' },
    { t: 'callout', x: { tone: 'info', label: 'Qué es una cita (Termin)', text: 'Una cita es un punto agendado con fecha, hora, dirección y contacto, asociado a un trabajo de la línea NE3 del operador DGF. Puede o no estar ligada a una orden de servicio.' } },

    { t: 'h1', x: '2. Acceso' },
    { t: 'steps', x: [
      'Abra LUMEN en el navegador (o instálela en el móvil: “Agregar a pantalla de inicio”).',
      'Ingrese con su correo y contraseña (bsandoval@umtelkomd.com).',
      'Entra directamente a su agenda de citas NE3 (DGF).',
    ] },

    { t: 'h1', x: '3. Su agenda de citas' },
    { t: 'p', x: 'La pantalla principal lista las citas NE3 del operador DGF, con su fecha/hora, dirección, contacto y estado. Puede filtrar por fecha y por estado para enfocarse en lo pendiente.' },
    { t: 'bullets', x: [
      'Cada fila muestra: fecha y hora, dirección, contacto y estado.',
      'Toque una cita para ver el detalle y actuar sobre ella.',
    ] },

    { t: 'h1', x: '4. Agendar una cita nueva' },
    { t: 'steps', x: [
      'Toque “Nueva cita”.',
      'Indique fecha y hora, duración estimada y dirección.',
      'Cargue el contacto (nombre y teléfono) del punto.',
      'Si corresponde, vincule la cita a una orden NE3 existente.',
      'Guarde: la cita queda en estado “Propuesta”.',
    ] },
    { t: 'callout', x: { tone: 'info', label: 'Línea y operador', text: 'El sistema asigna automáticamente la línea NE3 y el operador DGF según su perfil, de modo que usted se concentra en la cita.' } },

    { t: 'h1', x: '5. Estados de una cita' },
    { t: 'bullets', x: [
      'Propuesta › Confirmada: cuando el punto/operador acepta la fecha.',
      'Confirmada › Reagendada: si hay que mover la cita a otra fecha/hora.',
      'Confirmada › Completada: cuando el trabajo de la cita se realizó.',
      'Cualquiera › Cancelada: si la cita ya no va.',
    ] },

    { t: 'h1', x: '6. Acciones del día a día' },
    { t: 'bullets', x: [
      'Confirmar: pasa una cita propuesta a confirmada.',
      'Reagendar: cambia fecha/hora y deja registro del motivo en notas.',
      'Completar: marca la cita como realizada.',
      'Cancelar: cierra la cita con el motivo correspondiente.',
    ] },
    { t: 'callout', x: { tone: 'ok', label: 'Buena práctica', text: 'Use el campo de notas para dejar el motivo de cada reagende o cancelación. Mantenga las citas al día: es la foto del trabajo NE3 con DGF.' } },

    { t: 'h1', x: '7. Soporte' },
    { t: 'callout', x: { tone: 'info', label: 'Soporte', text: `Dudas sobre su acceso o las citas: ${ACK_EMAIL} o su contacto en HMR Nexus.` } },
  ],
  ack: {
    ackTitle: '8. Confirmación de lectura y recibido',
    ackIntro: 'Para dejar constancia de que leyó y recibió este manual, escanee el código QR con la cámara del móvil. Se abrirá su app de correo con un mensaje ya redactado: complete su nombre y envíelo.',
    ackHowTitle: 'Cómo confirmar',
    ackSteps: [
      'Abra la cámara del móvil y apunte al código QR.',
      'Toque la notificación: se abre su app de correo con el mensaje pre-cargado.',
      'Complete su nombre y fecha en el cuerpo del correo.',
      'Envíe el correo. Listo: su lectura queda confirmada.',
    ],
    ackNoteLabel: 'Importante',
    ackNote: 'El correo se envía desde su propia cuenta. Si el QR no abre el correo, escriba manualmente a ' + ACK_EMAIL + ' con el asunto “Confirmación de lectura — Manual Citas NE3 (DGF)”.',
    ackManualTitle: 'Confirmación manual (alternativa)',
    ackFieldName: 'Nombre y apellido',
    ackFieldDate: 'Fecha',
    ackFieldSign: 'Firma',
    ackFieldTeam: 'Operador / línea',
    ackSubject: `Confirmación de lectura — Manual Citas NE3 (DGF) (v${VERSION})`,
    ackBody: `Confirmo que he leído y recibido el Manual del perfil Citas NE3 (DGF) de LUMEN, versión ${VERSION}.\n\nNombre:\nFecha:`,
  },
}

// ----------------------------------------------------------------------------
// Build
// ----------------------------------------------------------------------------
async function build(def, filename) {
  const man = new Manual(def.meta)
  man.cover()
  man.newPage()
  man.render(def.blocks)
  await man.confirmationPage(def.ack)
  const path = man.save(filename)
  console.log(`✓ ${filename}  (${man.page} págs)`)
  return path
}

console.log('Generando manuales LUMEN…')
await build(internal, 'manual-interno-es.pdf')
await build(external, 'handbuch-extern-de.pdf')
await build(externalEs, 'manual-externo-es.pdf')
await build(admin, 'manual-administrador-es.pdf')
await build(citasNe3, 'manual-citas-ne3-es.pdf')
console.log(`Listo → ${outDir}`)
