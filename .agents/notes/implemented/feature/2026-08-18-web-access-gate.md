# Agent Note: Web UI shared-secret access gate

Status: implemented

English | [中文](2026-08-18-web-access-gate.zh.md)

## Problem

The Web UI HTTP carrier had no authentication. `dsh web --host 0.0.0.0` was refused because an all-interfaces bind would expose remote code execution (`session.prompt` drives bash) to every host that can open the origin. Phone access over the public internet therefore had no supported path: the `/api` Host fence is a confused-deputy defense ([browser-trust boundary](../architecture/2026-07-28-api-browser-trust-boundary.md)), not a login, and privileged methods stay loopback-only.

## Decision

**A composing-application request guard on `ctx.webServer` holds a shared secret; the CLI allows `--host 0.0.0.0` only when that secret is present and long enough.**

- `WebServer.registerGuard` runs before named routes, the fallback seat, and upgrade dispatch. `handled` completes the exchange; omitted `upgrade` leaves upgrades unblocked. The table is effect-scoped.
- `@deepseek-ai/dsh-host-access-gate` is the shipped guard. Trimmed-empty `secret` installs nothing (loopback `dsh web` unchanged). A non-empty secret shorter than 16 characters fails at load. Binding `0.0.0.0` with an empty secret also fails at load. The Web bundle reads `secret` from `DSH_ACCESS_SECRET`.
- Unauthenticated HTML GET/HEAD receives a no-JavaScript Chinese login page. The document forces `color-scheme: light` and sets the password field's `color`, background, `-webkit-text-fill-color`, and `caret-color` so a dark OS theme cannot hide typed bullets; `font-size: 16px` avoids iOS input zoom. `POST /__dsh/access` accepts form `secret=` or JSON `{secret}` and sets an HttpOnly `dsh_access` HMAC cookie (`SameSite=Lax`, `Path=/`, `Max-Age`=`ttlSeconds`, `Secure` when the request is HTTPS or `X-Forwarded-Proto` starts with `https`). Unauthenticated `/api` and other non-GET/HEAD answer 401. Unauthenticated upgrades are rejected. Failed logins are limited to five per 60 seconds per `socket.remoteAddress`.
- The cookie stores expiry plus HMAC, not the secret. This is not a user-account system: everyone who knows the secret is the same principal. TLS termination stays with a reverse proxy. Privileged `/api` methods remain loopback-only.

## Alternatives considered

**HTTP Basic authentication.** Rejected: every request would carry the secret, there is no dedicated mobile login page, and browsers cache Basic credentials in ways this product does not want to own.

**Treat the LAN as a trusted network and skip a secret.** Rejected: a phone over WAN is not a trusted LAN, and `session.prompt` is remote code execution.

**Operator accounts or SSO.** Out of scope: the harness has no employee identity; anonymous `$DSH_HOME` is not an account store.

**Gate only `/api`.** Rejected: unauthenticated SPA bytes and upgrades would still leak the session UI and event streams; the interceptor has to sit on the HTTP carrier.

## Consequences

A phone can open the public origin, enter the secret, and use the ordinary session UI, including `session.prompt`. Settings, credentials, native pick/open, and agent-preset authoring stay loopback-only. A public bind without a TLS reverse proxy leaks the secret and cookie on the wire. The guard registers in `apply` after the webserver already listens, so a request in that boot window can miss the gate. The Host fence and the access gate remain separate: a public Host still needs `--trusted-host` (or a derived LAN IP) in addition to the cookie.

Cross-links: [explicit web bind address](./2026-07-22-web-bind-address.md), [api browser-trust boundary](../architecture/2026-07-28-api-browser-trust-boundary.md).
