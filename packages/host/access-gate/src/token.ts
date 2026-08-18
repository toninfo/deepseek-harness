/**
 * HMAC access-cookie tokens: expiry plus a signature over that expiry, keyed
 * from the configured shared secret. The cookie never stores the secret.
 * @module @deepseek-ai/dsh-host-access-gate/token
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Cookie name written after a successful login. */
export const ACCESS_COOKIE = 'dsh_access'

/** Minimum trimmed secret length; shorter non-empty values fail closed at load. */
export const ACCESS_SECRET_MIN_LENGTH = 16

const HMAC_KEY_CONTEXT = 'dsh-access-cookie-v1'
const COMPARE_CONTEXT = 'dsh-access-secret-compare'

/**
 * Compare two secrets in constant time by HMAC-digesting both first, so
 * unequal lengths cannot throw out of `timingSafeEqual`.
 * @param left - submitted secret.
 * @param right - configured secret.
 * @returns whether the two strings are equal.
 */
export function secretsEqual(left: string, right: string): boolean {
  const leftDigest = createHmac('sha256', COMPARE_CONTEXT).update(left).digest()
  const rightDigest = createHmac('sha256', COMPARE_CONTEXT).update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

/**
 * @param secret - configured shared secret.
 * @returns the HMAC key derived from the secret.
 */
function signingKey(secret: string): Buffer {
  return createHmac('sha256', HMAC_KEY_CONTEXT).update(secret).digest()
}

/**
 * Mint a cookie value that expires `ttlSeconds` after `nowMs`.
 * @param secret - configured shared secret.
 * @param ttlSeconds - lifetime from `nowMs`.
 * @param nowMs - wall-clock milliseconds (tests inject a sample).
 * @returns `expiryUnix.hmacHex`.
 */
export function mintAccessToken(secret: string, ttlSeconds: number, nowMs = Date.now()): string {
  const payload = String(Math.floor(nowMs / 1000) + ttlSeconds)
  const sig = createHmac('sha256', signingKey(secret)).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/**
 * Accept a cookie value only when its signature matches and it has not expired.
 * @param secret - configured shared secret.
 * @param token - cookie value.
 * @param nowMs - wall-clock milliseconds (tests inject a sample).
 * @returns whether the token authorizes this request.
 */
export function verifyAccessToken(secret: string, token: string, nowMs = Date.now()): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^[0-9]+$/.test(payload) || !/^[0-9a-f]+$/.test(sig)) return false
  if (Number(payload) * 1000 <= nowMs) return false
  const expected = createHmac('sha256', signingKey(secret)).update(payload).digest('hex')
  if (sig.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}
