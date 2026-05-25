import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { GLOSSARY } from '@/i18n/glossary'

interface TProps {
  de: string
  children?: ReactNode
}

/**
 * <T de="Hausanschluss">Hausanschluss</T>
 *
 * Renderiza el texto alemán. Cuando Lernmodus está activo (clase
 * "learn-mode" en <body>), aparece un icono `ⁱ` chiquito al lado que
 * abre tooltip con traducción ES + explicación contextual.
 *
 * Si `children` se omite, usa `de` como texto visible.
 * Si el término no está en el glosario, renderiza el texto sin icono.
 */
export function T({ de, children }: TProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; flipped: boolean } | null>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const entry = GLOSSARY[de]

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('click', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('click', close)
    }
  }, [open])

  if (!entry) return <>{children ?? de}</>

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (open) {
      setOpen(false)
      return
    }
    const r = iconRef.current?.getBoundingClientRect()
    if (!r) return
    let top = r.bottom + window.scrollY + 8
    let left = r.left + window.scrollX - 6
    let flipped = false
    if (r.bottom + 200 > window.innerHeight) {
      top = r.top + window.scrollY - 8 - 200
      flipped = true
    }
    const maxLeft = window.scrollX + window.innerWidth - 300
    if (left > maxLeft) left = maxLeft
    setCoords({ top, left, flipped })
    setOpen(true)
  }

  return (
    <>
      {children ?? de}
      <span
        ref={iconRef}
        role="button"
        tabIndex={0}
        className="t-icon"
        aria-label={`Übersetzung: ${entry.es}`}
        title="Übersetzung anzeigen"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as unknown as MouseEvent)
          }
        }}
      >
        i
      </span>
      {open && coords && (
        <span
          className={`t-tooltip${coords.flipped ? ' flipped' : ''}`}
          style={{ top: coords.top, left: coords.left, position: 'absolute' }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="es">{entry.es}</span>
          <strong>{de}</strong>
          {entry.concept && <span className="concept">{entry.concept}</span>}
        </span>
      )}
    </>
  )
}
