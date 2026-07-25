import type { AuthUser } from '@/context/authTypes'

const SESSION_KEY = 'lumen-pin-session-v1'
const DEVICE_KEY = 'lumen-pin-device-id-v1'
const LOCAL_PIN_ITERATIONS = 120_000

interface StoredPinSession {
  accessToken: string
  expiresAt: number
  user: AuthUser
  deviceId: string
  localPinHash: string
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

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

async function derivePin(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function hashLocalPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePin(pin, salt, LOCAL_PIN_ITERATIONS)
  return `pbkdf2$${LOCAL_PIN_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

async function verifyLocalPin(pin: string, stored: string): Promise<boolean> {
  const [kind, iterationsRaw, saltRaw, hashRaw] = stored.split('$')
  if (kind !== 'pbkdf2' || !iterationsRaw || !saltRaw || !hashRaw) return false
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations)) return false
  const actual = await derivePin(pin, base64ToBytes(saltRaw), iterations)
  return timingSafeEqual(actual, base64ToBytes(hashRaw))
}

export function getPinDeviceId(): string {
  if (!hasStorage()) return crypto.randomUUID()
  const existing = window.localStorage.getItem(DEVICE_KEY)
  if (existing) return existing
  const next = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_KEY, next)
  return next
}

export function getStoredPinSession(): StoredPinSession | null {
  if (!hasStorage()) return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredPinSession
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function getPinAccessToken(): string | null {
  const session = getStoredPinSession()
  if (!session) return null
  if (session.expiresAt * 1000 <= Date.now()) return null
  return session.accessToken
}

export type PinSessionStatus =
  | { status: 'none' }
  | { status: 'active'; accessToken: string }
  | { status: 'expired' }

/** Like getPinAccessToken(), but tells "no PIN session" apart from "the PIN
 *  session timed out" — callers must not silently downgrade the second case to
 *  an anonymous request. */
export function getPinSessionStatus(): PinSessionStatus {
  const session = getStoredPinSession()
  if (!session) return { status: 'none' }
  if (session.expiresAt * 1000 <= Date.now()) return { status: 'expired' }
  return { status: 'active', accessToken: session.accessToken }
}

/** Fired when a stored PIN session is found expired mid-flight; AuthContext
 *  listens and forces a re-login instead of leaving a half-authenticated UI. */
export const PIN_SESSION_EXPIRED_EVENT = 'lumen:pin-session-expired'

export function notifyPinSessionExpired(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PIN_SESSION_EXPIRED_EVENT))
}

export async function storePinSession(
  accessToken: string,
  expiresAt: number,
  user: AuthUser,
  pin: string,
): Promise<void> {
  if (!hasStorage()) return
  const deviceId = getPinDeviceId()
  const localPinHash = await hashLocalPin(pin)
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken,
    expiresAt,
    user,
    deviceId,
    localPinHash,
  } satisfies StoredPinSession))
}

export async function getOfflinePinUser(pin: string, profileId: string): Promise<AuthUser | null> {
  const session = getStoredPinSession()
  if (!session) return null
  if (session.user.id !== profileId) return null
  const ok = await verifyLocalPin(pin, session.localPinHash)
  return ok ? session.user : null
}

export function clearPinSession(): void {
  if (!hasStorage()) return
  window.localStorage.removeItem(SESSION_KEY)
}
