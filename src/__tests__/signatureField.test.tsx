// Plan 011 correction: the engine accepts `client_signature = false`, so the
// control must produce it. The harness mirrors CapturePlanForm's exact wiring.

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { SignatureField, type SignatureControl } from '@/components/capture/SignatureField'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const onCapture = vi.fn(async () => true)
const control: SignatureControl = { url: null, uploading: false, onCapture, onClear: async () => true }

function Harness() {
  const [value, setValue] = useState<boolean | null>(null)
  return (
    <>
      <SignatureField
        control={control}
        signed={value === true}
        declined={value === false}
        onSigned={() => setValue(true)}
        onCleared={() => setValue(null)}
        onDeclined={() => setValue(false)}
      />
      <output data-testid="value">{String(value)}</output>
    </>
  )
}

describe('SignatureField refusal (plan 011)', () => {
  it('reaches client_signature = false through the rendered control, undoably', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await act(async () => createRoot(container).render(<Harness />))
    const button = (label: string): HTMLButtonElement => {
      const found = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
      if (!found) throw new Error(`No button labelled "${label}"`)
      return found
    }
    const value = () => container.querySelector('[data-testid="value"]')?.textContent

    await act(async () => button(i18n.t('capture.signature.decline')).click())
    expect(value()).toBe('false')
    expect(container.textContent).toContain(i18n.t('capture.signature.declined'))
    expect(onCapture).not.toHaveBeenCalled()

    // The refusal is undoable: back to unanswered, with signing offered again.
    await act(async () => button(i18n.t('capture.signature.undo')).click())
    expect(value()).toBe('null')
    expect(button(i18n.t('capture.signature.action'))).toBeTruthy()
  })
})
