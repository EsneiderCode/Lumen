import { GraduationCap } from 'lucide-react'
import { useLernmodus } from '@/hooks/useLernmodus'

/**
 * Botón para activar/desactivar Lernmodus. Cuando está activo, los términos
 * del glosario muestran un icono `ⁱ` que abre traducción + explicación.
 */
export function LernmodusToggle() {
  const { on, toggle } = useLernmodus()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label="Lernmodus umschalten"
      title={on ? 'Lernmodus deaktivieren' : 'Lernmodus aktivieren'}
      className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
        on
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-line bg-bg-1 text-fg-3 hover:text-fg-1 hover:border-line-s'
      }`}
    >
      <span className="flex items-center gap-2">
        <GraduationCap size={14} strokeWidth={1.5} />
        Lernmodus
      </span>
      <span
        className={`inline-block h-3 w-6 rounded-full border transition-colors ${
          on ? 'border-accent bg-accent' : 'border-line bg-bg-2'
        }`}
      >
        <span
          className={`block h-2.5 w-2.5 rounded-full bg-bg-0 transition-transform ${
            on ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
