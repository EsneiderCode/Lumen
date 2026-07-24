// compliance-ocr — turn an uploaded document into raw text for field pre-fill.
//
// POST multipart/form-data: file (PDF / JPEG / PNG, max 15 MB).
// Returns { text } — the OCR'd plain text. ALL field parsing happens client-side
// in the shared pure helper (src/services/complianceHelpers.ts) so it stays
// deterministic and unit-tested; this function is only the OCR bridge.
//
// Provider-agnostic: it forwards the file to a configurable OCR endpoint
// (OCR_API_URL, optional OCR_API_KEY bearer) that must answer { text }. When no
// provider is configured it returns { text: '' } — the feature degrades to a
// no-op and the upload form is simply filled by hand. Best-effort throughout: a
// provider error never blocks the upload, it just yields empty text.
//
// verify_jwt = true (config.toml): any authenticated user who may upload can OCR.

import { CORS_HEADERS, json } from '../_shared/http.ts'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

// Keep in sync with src/services/complianceHelpers.ts (sniffFileKind).
function sniffFileKind(bytes: Uint8Array): 'pdf' | 'jpeg' | 'png' | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png'
  return null
}

/** Forwards the file to the configured OCR provider; '' when unconfigured or on error. */
async function runOcr(file: File): Promise<string> {
  const apiUrl = Deno.env.get('OCR_API_URL')
  if (!apiUrl) return ''
  try {
    const form = new FormData()
    form.append('file', file, file.name)
    const apiKey = Deno.env.get('OCR_API_KEY')
    const res = await fetch(apiUrl.replace(/\/$/, ''), {
      method: 'POST',
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { text?: unknown }
    return typeof data.text === 'string' ? data.text : ''
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json(400, { error: 'invalid_form' })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return json(400, { error: 'file_required' })
  if (file.size > MAX_UPLOAD_BYTES) return json(413, { error: 'file_too_large' })

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!sniffFileKind(head)) return json(415, { error: 'file_type_not_allowed' })

  const text = await runOcr(file)
  return json(200, { text })
})
