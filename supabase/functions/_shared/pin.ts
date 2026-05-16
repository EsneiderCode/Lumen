const HASH_ALGORITHM = 'PBKDF2-SHA256'
const HASH_ITERATIONS = 210_000
const SALT_BYTES = 16
const KEY_BYTES = 32

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function derivePin(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    KEY_BYTES * 8,
  )
  return new Uint8Array(bits)
}

export function normalizeLoginCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function assertValidPin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must contain 4 to 8 digits')
  }
}

export async function hashPin(pin: string): Promise<string> {
  assertValidPin(pin)
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derivePin(pin, salt, HASH_ITERATIONS)
  return [
    HASH_ALGORITHM,
    String(HASH_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join('$')
}

export async function verifyPin(pin: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false
  const [algorithm, iterationsRaw, saltRaw, hashRaw] = storedHash.split('$')
  if (algorithm !== HASH_ALGORITHM || !iterationsRaw || !saltRaw || !hashRaw) return false
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations < 100_000) return false

  const expected = base64ToBytes(hashRaw)
  const actual = await derivePin(pin, base64ToBytes(saltRaw), iterations)
  return timingSafeEqual(actual, expected)
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function sanitizeUserAgent(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 240)
}
