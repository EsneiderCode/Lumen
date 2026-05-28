import { useEffect } from 'react'
import { useLernmodus } from '@/hooks/useLernmodus'

/**
 * Sincroniza el estado de Lernmodus con `body.learn-mode`. El componente
 * <T> renderiza siempre el icono `i`, pero el CSS lo oculta cuando esta
 * clase no está presente. Montar una sola vez en el root.
 */
export function LernmodusBodyClass() {
  const { on } = useLernmodus()
  useEffect(() => {
    document.body.classList.toggle('learn-mode', on)
  }, [on])
  return null
}
