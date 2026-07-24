// compliance-upload — validated document upload for the compliance module.
//
// POST multipart/form-data:
//   entity_document_id  uuid of the entity_documents slot
//   metadata            JSON: { issued_at, expires_at, amount, notes? }
//   direct_approve      'true' → admin one-step flow (upload + approve);
//                       requires compliance.review permission
//   file                the document (PDF / JPEG / PNG, max 15 MB)
//
// Enforcement (decided in Fase 1): NO antivirus — real file-type validation
// via magic bytes plus a size cap. Authorization: the caller must either own
// the compliance entity (contractor portal) or hold compliance.review.
// Keep the signature check in sync with src/services/complianceHelpers.ts.

import { CORS_HEADERS, env, json, supabaseFetch, userIdFromJwt } from '../_shared/http.ts'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const BUCKET = 'compliance-documents'

interface EntityDocumentRow {
  id: string
  entity_id: string
  status: string
  current_version_id: string | null
}

interface EntityRow {
  id: string
  profile_id: string | null
  parent_entity_id: string | null
}

interface VersionRow {
  id: string
  version_number: number
  [key: string]: unknown
}

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

const KIND_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

async function hasPermission(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  try {
    const allowed = await supabaseFetch<boolean>(
      supabaseUrl,
      serviceRoleKey,
      'rpc/user_has_permission',
      { method: 'POST', body: JSON.stringify({ uid: userId, perm: permission }) },
    )
    return allowed === true
  } catch {
    return false
  }
}

/** Walk the parent chain: a caller owns worker entities of their company. */
async function ownsEntity(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  entityId: string,
): Promise<boolean> {
  let currentId: string | null = entityId
  for (let depth = 0; currentId && depth < 4; depth++) {
    const rows = await supabaseFetch<EntityRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `compliance_entities?id=eq.${encodeURIComponent(currentId)}&select=id,profile_id,parent_entity_id`,
    )
    const entity = rows[0]
    if (!entity) return false
    if (entity.profile_id === userId) return true
    currentId = entity.parent_entity_id
  }
  return false
}

function parseMetadata(raw: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    const auth = req.headers.get('authorization')
    if (!auth) return json(401, { error: 'Missing authorization' })
    const userId = userIdFromJwt(auth)
    if (!userId) return json(401, { error: 'Invalid authorization' })

    const form = await req.formData()
    const entityDocumentId = String(form.get('entity_document_id') ?? '')
    const directApprove = form.get('direct_approve') === 'true'
    const metadata = parseMetadata(form.get('metadata'))
    const file = form.get('file')

    if (!entityDocumentId) return json(400, { error: 'entity_document_id is required' })
    if (!(file instanceof File)) return json(400, { error: 'file is required' })
    if (file.size > MAX_UPLOAD_BYTES) return json(413, { error: 'file_too_large' })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = sniffFileKind(bytes)
    if (!kind) return json(415, { error: 'file_type_not_allowed' })

    const itemRows = await supabaseFetch<EntityDocumentRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `entity_documents?id=eq.${encodeURIComponent(entityDocumentId)}&select=id,entity_id,status,current_version_id`,
    )
    const item = itemRows[0]
    if (!item) return json(404, { error: 'Checklist item not found' })

    const isReviewer = await hasPermission(supabaseUrl, serviceRoleKey, userId, 'compliance.review')
    if (!isReviewer && !(await ownsEntity(supabaseUrl, serviceRoleKey, userId, item.entity_id))) {
      return json(403, { error: 'Not allowed to upload for this entity' })
    }
    if (directApprove && !isReviewer) {
      return json(403, { error: 'direct_approve requires compliance.review' })
    }

    // Next version number for this slot.
    const lastVersions = await supabaseFetch<VersionRow[]>(
      supabaseUrl,
      serviceRoleKey,
      `document_versions?entity_document_id=eq.${encodeURIComponent(entityDocumentId)}&select=id,version_number&order=version_number.desc&limit=1`,
    )
    const versionNumber = (lastVersions[0]?.version_number ?? 0) + 1

    const safeName = sanitizeFileName(file.name || `document.${kind}`)
    const storagePath = `${item.entity_id}/${entityDocumentId}/${Date.now()}-v${versionNumber}-${safeName}`
    const contentType = KIND_MIME[kind]

    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          'content-type': contentType,
        },
        body: bytes,
      },
    )
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`Storage upload failed (${uploadRes.status}): ${text}`)
    }

    const versionInsert = await supabaseFetch<VersionRow[]>(
      supabaseUrl,
      serviceRoleKey,
      'document_versions',
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          entity_document_id: entityDocumentId,
          version_number: versionNumber,
          file_name: file.name || safeName,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: contentType,
          size_bytes: file.size,
          submitted_metadata: metadata,
          uploaded_by: userId,
        }),
      },
    )
    const version = versionInsert[0]
    if (!version) throw new Error('Version insert returned no row')

    const approvedPatch = directApprove
      ? {
          status: 'approved',
          approved_issued_at: metadata.issued_at ?? null,
          approved_expires_at: metadata.expires_at ?? null,
          approved_amount: metadata.amount ?? null,
          approved_metadata: metadata,
        }
      : { status: 'in_review' }

    await supabaseFetch<void>(
      supabaseUrl,
      serviceRoleKey,
      `entity_documents?id=eq.${encodeURIComponent(entityDocumentId)}`,
      {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ current_version_id: version.id, ...approvedPatch }),
      },
    )

    if (directApprove) {
      await supabaseFetch<void>(
        supabaseUrl,
        serviceRoleKey,
        'document_reviews',
        {
          method: 'POST',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({
            version_id: version.id,
            reviewer_id: userId,
            action: 'approved',
            approved_metadata: metadata,
          }),
        },
      )
    }

    // RGPD access trail for the upload itself. Best-effort: the file, its version
    // and the slot status are already persisted above, so an audit-log failure must
    // never fail the request (which would report a false error while the upload stuck)
    // nor leave the slot in a half-written state.
    try {
      await supabaseFetch<void>(
        supabaseUrl,
        serviceRoleKey,
        'document_access_log',
        {
          method: 'POST',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ version_id: version.id, accessed_by: userId, action: 'upload' }),
        },
      )
    } catch (logError) {
      console.error('[compliance-upload] access-log insert failed (non-fatal)', logError)
    }

    return json(201, { version })
  } catch (error) {
    console.error('[compliance-upload] failed', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
