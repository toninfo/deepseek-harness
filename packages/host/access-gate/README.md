# `@deepseek-ai/dsh-host-access-gate`

English | [中文](README.zh.md)

Shared-secret access gate for the Web UI: a function plugin (config `{secret, ttlSeconds}`) that registers a [`webServer.registerGuard`](../webserver/README.md) interceptor. A trimmed-empty `secret` installs nothing, so loopback `dsh web` is unchanged. A non-empty secret shorter than 16 characters fails at load. Binding `0.0.0.0` with an empty secret also fails at load. A long enough secret serves a no-JavaScript Chinese login page on unauthenticated HTML GET/HEAD. The page follows the Host Appearance preference (`ui-theme.preference`: `light`, `dark`, or `system`); missing settings use `system` and `prefers-color-scheme`, and both palettes set the password field's `color`, fill, and caret so typed bullets stay visible. It answers `POST /__dsh/access` (form field `secret=` or JSON `{secret}`), sets an HttpOnly `dsh_access` HMAC cookie (`SameSite=Lax`, `Path=/`, `Max-Age`=`ttlSeconds`, `Secure` when the request is HTTPS or `X-Forwarded-Proto` starts with `https`), rejects unauthenticated `/api` and other non-GET/HEAD with 401, and rejects unauthenticated HTTP upgrades. `POST /__dsh/access/logout` clears the cookie. Failed logins are limited to five per 60 seconds per `socket.remoteAddress` (never `X-Forwarded-For`). The shipped Web bundle reads `secret` from `DSH_ACCESS_SECRET`. The cookie stores an expiry plus HMAC, not the secret; changing the secret invalidates outstanding cookies.

Decision record: [web access gate Agent Note](../../../.agents/notes/implemented/feature/2026-08-18-web-access-gate.md).

## Model Experience

None, as the package gates browser HTTP before any model request is assembled.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Shared secret, not operator identity** — everyone who knows the secret is the same principal; Settings, credentials, native pick/open, and agent-preset authoring stay loopback-only.
- **No TLS** — plain HTTP on a public bind leaks the secret and cookie; put a TLS reverse proxy in front and overwrite `X-Forwarded-Proto` rather than appending a client-supplied value.
- **Guard registers in `apply` after listen** — the webserver already accepts connections during activation, so a request in that boot window can miss the gate.
- **Rate limit keys the direct TCP peer** — a reverse proxy collapses every client into one bucket.
