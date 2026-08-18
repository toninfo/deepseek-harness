/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-access-gate`.
 * @module @deepseek-ai/dsh-host-access-gate/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-access-gate'

/** Cordis companion plugin name. */
export const name = 'host-access-gate-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: the owned relation is the webserver guard table, and
 * `internal/plugin` fires before the disposing fiber's effects run, so a
 * live owner still holds the guard at notification time. Register/dispose
 * symmetry is covered by the package's real-composition HMR-safety test
 * instead.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
