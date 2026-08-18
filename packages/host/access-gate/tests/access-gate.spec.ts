/**
 * REAL-composition coverage: a test-only cordis.yml boots webserver plus
 * access-gate, and assertions observe the HTTP and upgrade surface — login
 * page, cookie, `/api` 401, upgrade rejection, logout, rate limit, HMR.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import * as AccessGate from '../src/index.ts'
import { LoginLimiter, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS } from '../src/rate-limit.ts'
import {
  ACCESS_COOKIE,
  ACCESS_SECRET_MIN_LENGTH,
  mintAccessToken,
  secretsEqual,
  verifyAccessToken,
} from '../src/token.ts'
import { renderLoginPage } from '../src/login-page.ts'

const SECRET = 'sixteen-chars-ok'
const SHORT = 'too-short'

/** Write a cordis.yml and boot it through the real Loader. */
async function loadComposition(options: {
  secret?: string
  ttlSeconds?: number
  host?: '127.0.0.1' | '0.0.0.0'
}): Promise<{ ctx: Context; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-access-gate-'))
  const configPath = join(root, 'cordis.yml')
  const secretLine = options.secret === undefined
    ? []
    : [`    secret: ${JSON.stringify(options.secret)}`]
  const ttlLine = options.ttlSeconds === undefined
    ? []
    : [`    ttlSeconds: ${String(options.ttlSeconds)}`]
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    `    host: '${options.host ?? '127.0.0.1'}'`,
    '    port: 0',
    '- id: gate',
    "  name: '@deepseek-ai/dsh-host-access-gate'",
    '  config:',
    ...secretLine,
    ...ttlLine,
    '',
  ].join('\n'))

  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', HttpServer],
    ['@deepseek-ai/dsh-host-access-gate', AccessGate],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  try {
    await ctx.loader.await()
  } catch (error) {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
    throw error
  }
  return { ctx, root }
}

/** Dispose a composition and its temp tree. */
async function disposeComposition(loaded: { ctx: Context; root: string }): Promise<void> {
  await loaded.ctx.fiber.dispose()
  await rm(loaded.root, { recursive: true, force: true })
}

/** POST without a Content-Type header so the gate's missing-header path runs. */
async function rawPost(port: number, path: string, body: string): Promise<{ status: number; location: string | undefined }> {
  return await new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
    }, (res) => {
      res.resume()
      res.once('end', () => {
        resolve({ status: res.statusCode ?? 0, location: res.headers.location })
      })
    })
    req.once('error', reject)
    req.end(body)
  })
}

/** GET/POST one path; returns status, headers, and the full body. */
async function request(
  port: number,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: string; headers: Headers }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, init)
  return {
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  }
}

describe('token helpers', () => {
  it('accepts a freshly minted token and rejects tampered or expired values', () => {
    const now = 1_700_000_000_000
    const token = mintAccessToken(SECRET, 60, now)
    expect(verifyAccessToken(SECRET, token, now)).toBe(true)
    expect(verifyAccessToken(SECRET, token, now + 61_000)).toBe(false)
    expect(verifyAccessToken(SECRET, 'no-dot', now)).toBe(false)
    expect(verifyAccessToken(SECRET, '.dead', now)).toBe(false)
    expect(verifyAccessToken(SECRET, 'abc.nothex', now)).toBe(false)
    expect(verifyAccessToken(SECRET, `${token}00`, now)).toBe(false)
    const [exp, sig] = token.split('.') as [string, string]
    expect(verifyAccessToken(SECRET, `${exp}.${sig.slice(0, -1)}x`, now)).toBe(false)
    expect(secretsEqual(SECRET, SECRET)).toBe(true)
    expect(secretsEqual(SECRET, `${SECRET}x`)).toBe(false)
    expect(ACCESS_SECRET_MIN_LENGTH).toBe(16)
    expect(ACCESS_COOKIE).toBe('dsh_access')
  })
})

describe('login limiter', () => {
  it('opens a new window after expiry and clears on success', () => {
    const limiter = new LoginLimiter()
    const t0 = 1_000
    expect(limiter.tooMany('127.0.0.1', t0)).toBe(false)
    for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i += 1) limiter.recordFailure('127.0.0.1', t0)
    expect(limiter.tooMany('127.0.0.1', t0)).toBe(true)
    expect(limiter.tooMany('127.0.0.1', t0 + LOGIN_WINDOW_MS)).toBe(false)
    limiter.recordFailure('127.0.0.1', t0 + LOGIN_WINDOW_MS)
    expect(limiter.tooMany('127.0.0.1', t0 + LOGIN_WINDOW_MS)).toBe(false)
    limiter.clear('127.0.0.1')
    expect(limiter.tooMany('127.0.0.1', t0 + LOGIN_WINDOW_MS)).toBe(false)
  })
})

describe('login page', () => {
  it('escapes interpolated error copy', () => {
    expect(renderLoginPage('&<>"')).toContain('&amp;&lt;&gt;&quot;')
    expect(renderLoginPage()).not.toContain('class="error"')
  })

  it('keeps the password field editable with an explicit caret color', () => {
    const html = renderLoginPage()
    const input = /<input\b[^>]*>/.exec(html)?.[0]
    expect(input).toBeDefined()
    expect(input).not.toMatch(/\bdisabled\b/)
    expect(input).not.toMatch(/\breadonly\b/)
    expect(html).toContain('caret-color: #0071e3')
    expect(html).toContain('color-scheme: light')
  })
})

describe('real Loader composition', () => {
  it('leaves the server ungated when the secret is empty', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ secret: '' })
    try {
      const port = loaded.ctx.webServer.port
      loaded.ctx.webServer.registerFallback((_req, res) => {
        res.writeHead(200)
        res.end('OPEN')
      })
      expect(await request(port, '/')).toMatchObject({ status: 200, body: 'OPEN' })
    } finally {
      await disposeComposition(loaded)
    }
  })

  it('fails load on a short secret and on 0.0.0.0 without a secret', { timeout: 60_000 }, async () => {
    await expect(loadComposition({ secret: SHORT })).rejects.toThrow(/secret must be at least 16 characters/)
    await expect(loadComposition({ host: '0.0.0.0', secret: '' })).rejects.toThrow(
      /required when the webserver binds 0\.0\.0\.0/,
    )
  })

  it('gates HTML, /api, upgrades, login, logout, JSON, and HMR', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ secret: SECRET, ttlSeconds: 3600 })
    try {
      const unloaded = [...loaded.ctx.loader.entries()]
        .filter(entry => entry.fiber === undefined && !entry.disabled)
        .map(entry => entry.options.name)
      expect(unloaded).toEqual([])
      const server = loaded.ctx.webServer
      const port = server.port
      server.registerFallback((_req, res) => {
        res.writeHead(200)
        res.end('SHELL')
      })
      server.register({
        kind: 'prefix',
        path: '/api',
        handler: (_req, res) => {
          res.writeHead(200)
          res.end('API')
        },
      })
      server.registerUpgrade({
        path: '/api/events.mux',
        handler: (_req, socket) => {
          socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: dsh-test\r\n\r\n')
        },
      })

      const login = await request(port, '/')
      expect(login.status).toBe(401)
      expect(login.body).toContain('请输入访问密钥以继续')
      expect((await request(port, '/', { method: 'HEAD' })).status).toBe(401)
      expect((await request(port, '/api/session')).status).toBe(401)
      expect((await request(port, '/', { method: 'POST' })).status).toBe(401)

      const deniedUpgrade = connect(port, '127.0.0.1')
      deniedUpgrade.on('error', () => { /* 401 close is the fixture outcome. */ })
      await once(deniedUpgrade, 'connect')
      const deniedUpgradeData = once(deniedUpgrade, 'data')
      deniedUpgrade.write([
        'GET /api/events.mux HTTP/1.1',
        `Host: 127.0.0.1:${String(port)}`,
        'Connection: Upgrade',
        'Upgrade: dsh-test',
        '',
        '',
      ].join('\r\n'))
      const [deniedBytes] = await deniedUpgradeData as [Buffer]
      expect(String(deniedBytes)).toContain('401 Unauthorized')

      const bareLogin = await rawPost(port, '/__dsh/access', `secret=${SECRET}`)
      expect(bareLogin.status).toBe(303)
      expect(bareLogin.location).toBe('/')

      const jsonLogin = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ secret: SECRET }),
        redirect: 'manual',
      })
      expect(jsonLogin.status).toBe(204)
      const jsonCookie = jsonLogin.headers.get('set-cookie') ?? ''
      expect(jsonCookie).toContain(`${ACCESS_COOKIE}=`)
      expect(jsonCookie).not.toContain('Secure')

      const httpsLogin = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-forwarded-proto': 'https, http',
        },
        body: `secret=${SECRET}`,
        redirect: 'manual',
      })
      expect(httpsLogin.status).toBe(303)
      expect(httpsLogin.headers.get('location')).toBe('/')
      const secureCookie = httpsLogin.headers.get('set-cookie') ?? ''
      expect(secureCookie).toContain('Secure')
      const cookie = secureCookie.split(';', 1)[0]!

      const wrong = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'secret=nope-nope-nope-nope',
        redirect: 'manual',
      })
      expect(wrong.status).toBe(401)
      expect(wrong.body).toContain('密钥不正确')

      const badJson = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
        redirect: 'manual',
      })
      expect(badJson.status).toBe(400)

      const missingField = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '[]',
        redirect: 'manual',
      })
      expect(missingField.status).toBe(401)

      const nullJson = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'null',
        redirect: 'manual',
      })
      expect(nullJson.status).toBe(401)

      const numericSecret = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"secret":1}',
        redirect: 'manual',
      })
      expect(numericSecret.status).toBe(401)

      const huge = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `secret=${'x'.repeat(5000)}`,
        redirect: 'manual',
      })
      expect(huge.status).toBe(413)

      const noField = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'foo=bar',
        redirect: 'manual',
      })
      expect(noField.status).toBe(401)

      expect(await request(port, '/', { headers: { cookie } })).toMatchObject({ status: 200, body: 'SHELL' })
      expect(await request(port, '/api/session', { headers: { cookie } })).toMatchObject({ status: 200, body: 'API' })

      const allowedUpgrade = connect(port, '127.0.0.1')
      await once(allowedUpgrade, 'connect')
      const allowedUpgradeData = once(allowedUpgrade, 'data')
      allowedUpgrade.write([
        'GET /api/events.mux HTTP/1.1',
        `Host: 127.0.0.1:${String(port)}`,
        `Cookie: ${cookie}`,
        'Connection: Upgrade',
        'Upgrade: dsh-test',
        '',
        '',
      ].join('\r\n'))
      const [allowedBytes] = await allowedUpgradeData as [Buffer]
      expect(String(allowedBytes)).toContain('101 Switching Protocols')
      allowedUpgrade.destroy()

      const junkCookie = await request(port, '/', { headers: { cookie: 'flag; other=1; =novalue' } })
      expect(junkCookie.status).toBe(401)

      const logout = await request(port, '/__dsh/access/logout', {
        method: 'POST',
        headers: { cookie },
        redirect: 'manual',
      })
      expect(logout.status).toBe(303)
      expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')

      const gateEntry = [...loaded.ctx.loader.entries()].find(e => e.options.id === 'gate')
      expect(gateEntry).toBeDefined()
      await gateEntry!.fiber?.dispose()
      expect(await request(port, '/')).toMatchObject({ status: 200, body: 'SHELL' })
    } finally {
      await disposeComposition(loaded)
    }
  })

  it('rate-limits repeated failed logins from the same peer', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({ secret: SECRET })
    try {
      const port = loaded.ctx.webServer.port
      let last = { status: 0, body: '' }
      for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i += 1) {
        last = await request(port, '/__dsh/access', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'secret=wrong-wrong-wrong',
          redirect: 'manual',
        })
        expect(last.status).toBe(401)
      }
      const blocked = await request(port, '/__dsh/access', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `secret=${SECRET}`,
        redirect: 'manual',
      })
      expect(blocked.status).toBe(429)
      expect(blocked.body).toContain('尝试次数过多')
    } finally {
      await disposeComposition(loaded)
    }
  })
})
