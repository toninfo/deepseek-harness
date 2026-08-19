# Agent Note: Browser RPC ids without a secure context

Status: implemented

English | [中文](2026-08-18-insecure-origin-rpc-id.zh.md)

## Problem

`AbstractApiClient.mintRpcId` called `crypto.randomUUID()`. That method is a secure-context Web API: browsers expose it on `https:` and on `http://localhost` / `http://127.0.0.1`, and omit or throw on other `http:` origins. A LAN IP (`http://192.168.2.4:3080`) or a named Host without TLS therefore threw `crypto.randomUUID is not a function` in the page before any `/api` POST left the browser. The Models settings page surfaced that as a directory load failure; workspace listing, session RPC, and draft image ids that used the same API failed the same way. Generic connection RPC already minted through `getRandomValues()`; the `IApiClient` face the UI actually calls did not.

## Decision

**The fetch-carrier client mints every client-originated rpcId with `crypto.getRandomValues()`, which browsers expose on insecure HTTP origins.**

`packages/host/apiproxy/src/fetch/random-uuid.ts` produces an RFC 4122 version 4 UUID. `AbstractApiClient.mintRpcId` and the connection package's existing helper both use it. Composer draft attachment ids and `createMessage` use `getRandomValues` when `crypto.randomUUID` is absent. The Host serves each plugin's built `/plugins/<id>/client.js`; a source-only edit does not reach a LAN browser until that bundle is rebuilt.

This does not change the Host fence or the privileged-method pin. Settings, credentials, native `host.pickDirectory` / `host.openPath`, `llm.discoverModels`, and agent-preset authoring stay loopback-only ([access gate](../feature/2026-08-18-web-access-gate.md)). An all-interfaces bind still mounts the in-app browse picker (`host.listDirectory`), which is not in that set.

## Alternatives considered

**Require HTTPS (or localhost) before any `/api` call.** Rejected: `dsh web --host 0.0.0.0` and a named Host without TLS are supported deployment shapes; the access gate already authenticates those origins. Forcing TLS would make the UUID throw the product error for a missing reverse proxy.

**Install a `crypto.randomUUID` polyfill on `window.crypto`.** Rejected: minting is one call site in the carrier; patching a platform object hides every other insecure-context API the page might later touch.

**Override only `WebApiClient.mintRpcId`.** Rejected: rpcId minting is a protocol invariant owned by `AbstractApiClient`; an in-process or future browser subclass would keep the throw.

## Consequences

A phone or LAN browser on `http://<lan-ip>` or `http://<trusted-host>` can mint rpcIds and use session UI, workspace browse, and `llm.providers`. Opening Settings → Models from that origin still fails at the privileged pin (`settings.describe` is loopback-only); configure providers and API keys at `http://127.0.0.1:3080`. A public HTTP bind still leaks the access-gate secret and cookie.

Cross-links: [web access gate](../feature/2026-08-18-web-access-gate.md), [api browser-trust boundary](../architecture/2026-07-28-api-browser-trust-boundary.md).
