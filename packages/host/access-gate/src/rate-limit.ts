/**
 * Per-direct-TCP-peer login failure limiter. Counts are keyed by
 * `socket.remoteAddress` and never by `X-Forwarded-For`.
 * @module @deepseek-ai/dsh-host-access-gate/rate-limit
 */

/** Failed logins allowed in one window before 429. */
export const LOGIN_ATTEMPT_LIMIT = 5

/** Failure-window length in milliseconds. */
export const LOGIN_WINDOW_MS = 60_000

/** One peer's failure window. */
interface Window {
  count: number
  resetAt: number
}

/** Counts failed logins per IP and answers whether the next attempt is blocked. */
export class LoginLimiter {
  private readonly hits = new Map<string, Window>()

  /**
   * Whether this peer's failure window is currently full.
   * @param ip - `socket.remoteAddress`, or `'unknown'` when Node omits it.
   * @param nowMs - wall-clock milliseconds (tests inject a sample).
   * @returns whether this peer is currently blocked.
   */
  tooMany(ip: string, nowMs: number): boolean {
    const row = this.hits.get(ip)
    if (row === undefined || nowMs >= row.resetAt) return false
    return row.count >= LOGIN_ATTEMPT_LIMIT
  }

  /**
   * Record one failed login for this peer, starting a new window when the
   * previous window has elapsed.
   * @param ip - `socket.remoteAddress`, or `'unknown'` when Node omits it.
   * @param nowMs - wall-clock milliseconds (tests inject a sample).
   */
  recordFailure(ip: string, nowMs: number): void {
    const row = this.hits.get(ip)
    if (row === undefined || nowMs >= row.resetAt) {
      this.hits.set(ip, { count: 1, resetAt: nowMs + LOGIN_WINDOW_MS })
      return
    }
    row.count += 1
  }

  /**
   * Drop this peer's failure window after a successful login.
   * @param ip - `socket.remoteAddress`, or `'unknown'` when Node omits it.
   */
  clear(ip: string): void {
    this.hits.delete(ip)
  }
}
