export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}

export type JsonRecord = Record<string, unknown>

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value.replace(/\/$/, '')
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

export async function supabaseFetch<T>(
  baseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${path} failed (${res.status}): ${text}`)
  }

  if (res.status === 204) return undefined as T
  return await res.json() as T
}

export async function selectOne<T extends JsonRecord>(
  baseUrl: string,
  serviceRoleKey: string,
  table: string,
  query: string,
): Promise<T | null> {
  const rows = await supabaseFetch<T[]>(baseUrl, serviceRoleKey, `${table}?${query}&limit=1`, {
    method: 'GET',
  })
  return rows[0] ?? null
}
