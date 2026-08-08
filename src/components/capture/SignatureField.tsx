// The client signature widget behind the `client_signature` capture field
// (plan 011 Gap C). The field value stays a boolean the engine and the SQL gate
// already understand; what this component adds is the evidence behind it: a
// hand-drawn signature, stored as a PNG next to the order's photos.
//
// Drawing uses pointer events, which unify mouse, touch and stylus — the
// technician hands the phone to the client at the door. Ink on paper: the
// canvas paints with the print-metaphor tokens, because what is being produced
// is a document, not a UI surface.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eraser, PenLine, Trash2, X } from 'lucide-react'

/** Wired by the page that owns uploads; absent = the field renders as before. */
export interface SignatureControl {
  /** Signed URL of the stored signature image, when one exists. */
  url: string | null
  uploading: boolean
  error?: string | null
  /** Uploads the drawn PNG. Resolves true on success. */
  onCapture: (blob: Blob) => Promise<boolean>
  /** Removes the stored image. Resolves true on success. */
  onClear: () => Promise<boolean>
}

function token(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function SignatureCanvas({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (blob: Blob) => void
  onCancel: () => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  /** Sizes the bitmap to the on-screen box once, at mount, DPR-sharp. */
  function initCanvas(canvas: HTMLCanvasElement | null) {
    canvasRef.current = canvas
    if (!canvas || canvas.dataset.ready) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    canvas.dataset.ready = 'true'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const paper = token('--color-paper')
    if (paper) {
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, rect.width, rect.height)
    }
    ctx.strokeStyle = token('--color-ink') || ctx.strokeStyle
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function pointOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function handleDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const { x, y } = pointOf(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // A dot is a stroke too: a very short signature must not stay unsavable.
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    setHasStroke(true)
  }

  function handleMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointOf(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handleUp() {
    drawingRef.current = false
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    const paper = token('--color-paper')
    if (paper) {
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, rect.width, rect.height)
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height)
    }
    setHasStroke(false)
  }

  function handleSave() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob)
    }, 'image/png')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={initCanvas}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="h-40 w-full rounded-m border border-line-s bg-paper"
        style={{ touchAction: 'none' }}
      />
      <p className="text-xs text-fg-3">{t('capture.signature.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasStroke || saving}
          className="inline-flex items-center gap-1.5 rounded-m border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors duration-200 enabled:hover:bg-accent/20 disabled:border-line disabled:text-fg-4"
        >
          <Check size={15} strokeWidth={1.5} />
          {saving ? t('capture.signature.saving') : t('capture.signature.save')}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasStroke || saving}
          className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-2 transition-colors duration-200 enabled:hover:border-accent enabled:hover:text-accent disabled:text-fg-4"
        >
          <Eraser size={14} strokeWidth={1.5} />
          {t('capture.signature.clear')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-2 transition-colors duration-200 enabled:hover:border-accent enabled:hover:text-accent"
        >
          <X size={14} strokeWidth={1.5} />
          {t('capture.signature.cancel')}
        </button>
      </div>
    </div>
  )
}

export function SignatureField({
  control,
  signed,
  onSigned,
  onCleared,
}: {
  control: SignatureControl
  /** Current boolean value of the `client_signature` field. */
  signed: boolean
  /** Sets the field once the image is safely stored — never before. */
  onSigned: () => void
  /** Clears the field once the image is gone. */
  onCleared: () => void
}) {
  const { t } = useTranslation()
  const [drawing, setDrawing] = useState(false)

  async function handleSave(blob: Blob) {
    const stored = await control.onCapture(blob)
    if (stored) {
      onSigned()
      setDrawing(false)
    }
  }

  async function handleRedo() {
    const cleared = await control.onClear()
    if (cleared) {
      onCleared()
      setDrawing(true)
    }
  }

  if (drawing && !control.uploading) {
    return (
      <div className="space-y-2">
        <SignatureCanvas onSave={handleSave} onCancel={() => setDrawing(false)} saving={false} />
        {control.error && <p className="text-xs text-accent">{control.error}</p>}
      </div>
    )
  }

  if (control.uploading) {
    return (
      <p className="rounded-m border border-line bg-bg-0 p-3 font-mono text-[11px] text-fg-3">
        {t('capture.signature.saving')}
      </p>
    )
  }

  if (signed) {
    return (
      <div className="space-y-2">
        {/* Offline the signed URL may not have arrived; the vouch still shows. */}
        {control.url && (
          <img
            src={control.url}
            alt={t('capture.signature.signed')}
            className="h-28 w-full rounded-m border border-line-s bg-paper object-contain"
          />
        )}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-s border border-ok/40 bg-ok/10 px-2 py-1 font-mono text-[11px] text-ok">
            <Check size={12} strokeWidth={1.5} />
            {t('capture.signature.signed')}
          </span>
          <button
            type="button"
            onClick={handleRedo}
            className="inline-flex items-center gap-1.5 rounded-m border border-line px-3 py-2 text-xs font-semibold text-fg-2 transition-colors duration-200 hover:border-accent hover:text-accent"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            {t('capture.signature.redo')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setDrawing(true)}
        className="inline-flex items-center gap-1.5 rounded-m border border-accent bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent/20"
      >
        <PenLine size={15} strokeWidth={1.5} />
        {t('capture.signature.action')}
      </button>
      {control.error && <p className="text-xs text-accent">{control.error}</p>}
    </div>
  )
}
