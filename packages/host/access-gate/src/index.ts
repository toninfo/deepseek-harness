/**
 * @deepseek-ai/dsh-host-access-gate — Shared-secret access gate over the
 * webserver request-guard table. An empty trimmed `secret` installs nothing
 * (loopback `dsh web` stays unchanged). A non-empty secret shorter than
 * {@link ACCESS_SECRET_MIN_LENGTH} fails at load. A long enough secret
 * registers a guard that serves a no-JavaScript login page, sets an HttpOnly
 * HMAC cookie, and rejects unauthenticated `/api` and upgrade traffic.
 * Binding `0.0.0.0` with an empty secret also fails at load.
 * @module @deepseek-ai/dsh-host-access-gate
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { WebGuardResult } from '@deepseek-ai/dsh-host-webserver'
import { renderLoginPage } from './login-page.ts'
import { LoginLimiter } from './rate-limit.ts'
import {
  ACCESS_COOKIE,
  ACCESS_SECRET_MIN_LENGTH,
  mintAccessToken,
  secretsEqual,
  verifyAccessToken,
} from './token.ts'

export { ACCESS_COOKIE, ACCESS_SECRET_MIN_LENGTH } from './token.ts'

/** Stable Cordis plugin name. */
export const name = 'access-gate'

/** Service required before the request guard can be registered. */
export const inject = ['webServer']

/** Login form and JSON POST path. */
export const ACCESS_LOGIN_PATH = '/__dsh/access'

/** Logout POST path. */
export const ACCESS_LOGOUT_PATH = '/__dsh/access/logout'

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60
const BODY_LIMIT = 4096
const TOO_LARGE = { tooLarge: true } as const
type TooLarge = typeof TOO_LARGE
const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
}

/** Plugin config: the shared secret and cookie lifetime. */
export interface Config {
  /** Shared secret; whitespace-only disables the gate. */
  secret: string
  /** Cookie lifetime in seconds; minimum 60. */
  ttlSeconds: number
}

export const Config: z<Config> = z.object({
  secret: z.string().default(''),
  ttlSeconds: z.natural().min(60).default(DEFAULT_TTL_SECONDS),
})

/**
 * @param header - a `Cookie` request header.
 * @param name - cookie name.
 * @returns the matching value, or `undefined`.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return undefined
}

/**
 * @param req - the incoming request.
 * @returns whether the request arrived over HTTPS, including a TLS proxy
 * that sets `X-Forwarded-Proto` (the first hop only).
 */
function isHttps(req: IncomingMessage): boolean {
  const proto = req.headers['x-forwarded-proto']
  if (typeof proto === 'string' && proto.split(',')[0]?.trim().toLowerCase() === 'https') return true
  /* v8 ignore next -- TLS sockets set `encrypted`; composition tests speak HTTP */
  return Boolean((req.socket as { encrypted?: boolean }).encrypted)
}

/**
 * @param token - cookie value.
 * @param ttlSeconds - Max-Age.
 * @param secure - whether to set the Secure attribute.
 * @returns a `Set-Cookie` value.
 */
function cookieHeader(token: string, ttlSeconds: number, secure: boolean): string {
  const parts = [
    `${ACCESS_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${String(ttlSeconds)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/**
 * @param req - the incoming request.
 * @param limit - maximum accepted bytes.
 * @returns the body, or the too-large sentinel when `limit` is exceeded.
 */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer | TooLarge> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const finish = (value: Buffer | TooLarge): void => {
      if (settled) return
      settled = true
      resolve(value)
    }
    req.on('data', (chunk: Buffer | string) => {
      /* v8 ignore next -- extra chunks after the limit trip are drained by resume() */
      if (settled) return
      const buf = Buffer.from(chunk)
      size += buf.length
      if (size > limit) {
        req.resume()
        finish(TOO_LARGE)
        return
      }
      chunks.push(buf)
    })
    req.once('end', () => { finish(Buffer.concat(chunks)) })
    /* v8 ignore start -- client-abort during body read; fetch tests do not abort */
    req.once('error', (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    })
    /* v8 ignore stop */
  })
}

/**
 * @param req - the incoming request.
 * @returns the secret submitted by form POST or JSON POST, or `undefined`.
 */
async function readSubmittedSecret(req: IncomingMessage): Promise<string | undefined | TooLarge> {
  const body = await readBody(req, BODY_LIMIT)
  if (!Buffer.isBuffer(body)) return TOO_LARGE
  const text = body.toString('utf8')
  const rawType = req.headers['content-type'] ?? ''
  const semi = rawType.indexOf(';')
  const media = (semi === -1 ? rawType : rawType.slice(0, semi)).trim().toLowerCase()
  if (media === 'application/json') {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const secret = (parsed as { secret?: unknown }).secret
    return typeof secret === 'string' ? secret : undefined
  }
  return new URLSearchParams(text).get('secret') ?? undefined
}

/**
 * @param req - the incoming request.
 * @returns the rate-limit key for this TCP peer.
 */
function peerAddress(req: IncomingMessage): string {
  /* v8 ignore next -- node:http sets remoteAddress on accepted sockets */
  return req.socket.remoteAddress ?? 'unknown'
}

/**
 * Register the access-gate request guard when a secret is configured.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const secret = config.secret.trim()
  if (secret.length === 0) {
    if (ctx.webServer.host === '0.0.0.0') {
      throw new Error(
        'access-gate: a trimmed secret of at least 16 characters is required when the webserver binds 0.0.0.0',
      )
    }
    return
  }
  if (secret.length < ACCESS_SECRET_MIN_LENGTH) {
    throw new Error(
      `access-gate: secret must be at least ${String(ACCESS_SECRET_MIN_LENGTH)} characters after trim (set DSH_ACCESS_SECRET or config.secret)`,
    )
  }

  const limiter = new LoginLimiter()
  const authorized = (req: IncomingMessage): boolean => {
    const token = readCookie(req.headers.cookie, ACCESS_COOKIE)
    return token !== undefined && verifyAccessToken(secret, token)
  }

  const denyHtml = (res: ServerResponse, status: number, error?: string): void => {
    res.writeHead(status, HTML_HEADERS)
    res.end(renderLoginPage(error))
  }

  const denyPlain = (res: ServerResponse, status: number, body: string): void => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(body)
  }

  const handleLogin = async (req: IncomingMessage, res: ServerResponse): Promise<WebGuardResult> => {
    const ip = peerAddress(req)
    const now = Date.now()
    if (limiter.tooMany(ip, now)) {
      denyHtml(res, 429, '尝试次数过多，请稍后再试。')
      return 'handled'
    }
    let submitted: string | undefined | TooLarge
    try {
      submitted = await readSubmittedSecret(req)
    } catch {
      denyPlain(res, 400, 'Bad Request')
      return 'handled'
    }
    if (typeof submitted === 'object') {
      denyPlain(res, 413, 'Payload Too Large')
      return 'handled'
    }
    if (submitted === undefined || !secretsEqual(submitted, secret)) {
      limiter.recordFailure(ip, now)
      denyHtml(res, 401, '密钥不正确。')
      return 'handled'
    }
    limiter.clear(ip)
    const token = mintAccessToken(secret, config.ttlSeconds)
    const json = (req.headers['content-type'] ?? '').includes('application/json')
    res.writeHead(json ? 204 : 303, {
      'set-cookie': cookieHeader(token, config.ttlSeconds, isHttps(req)),
      ...json ? {} : { location: '/' },
    })
    res.end()
    return 'handled'
  }

  const handleLogout = (req: IncomingMessage, res: ServerResponse): WebGuardResult => {
    res.writeHead(303, {
      'set-cookie': cookieHeader('', 0, isHttps(req)),
      location: '/',
    })
    res.end()
    return 'handled'
  }

  const http = async (req: IncomingMessage, res: ServerResponse): Promise<WebGuardResult> => {
    /* v8 ignore next -- node:http always sets url on server requests */
    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (path === ACCESS_LOGIN_PATH && req.method === 'POST') return handleLogin(req, res)
    if (path === ACCESS_LOGOUT_PATH && req.method === 'POST') return handleLogout(req, res)
    if (authorized(req)) return 'pass'
    if (path.startsWith('/api') || (req.method !== 'GET' && req.method !== 'HEAD')) {
      denyPlain(res, 401, 'Unauthorized')
      return 'handled'
    }
    denyHtml(res, 401)
    return 'handled'
  }

  const upgrade = (req: IncomingMessage, socket: Duplex): WebGuardResult => {
    if (authorized(req)) return 'pass'
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return 'handled'
  }

  ctx.effect(() => ctx.webServer.registerGuard({ http, upgrade }), 'access-gate: request guard')
}
