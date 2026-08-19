/**
 * Pure concession-chain column solver for the three-column AppFrame.
 * Chain order is fixed by contract: keep center >= CENTER_MIN by shrinking
 * details, then auto-closing it (derived zero width — preferred width
 * preferences are never rewritten, so widening the window restores them).
 * The sidebar never concedes: its rendered width is always the drag
 * preference (or the collapsed rail / zero when phone-hidden), and center
 * absorbs any remaining deficit as the last resort. Inputs are the layout
 * store's plain width preferences (0 = closed); a closed sidebar resolves to
 * the fixed SIDEBAR_COLLAPSED control rail unless `hideClosedSidebar` asks
 * for true zero (phone drawer mode). Closed details resolve to zero width.
 * SIDEBAR_AUTO_COLLAPSE and SIDEBAR_PHONE are consumed by AppFrame; the
 * solver itself stays breakpoint-free.
 */

/** Resolved widths for one frame; center may drop below CENTER_MIN only at the final fallback. */
export interface Columns { sidebar: number; center: number; details: number }

/** Optional closed-sidebar resolution; phone mode passes `hideClosedSidebar`. */
export interface ComputeColumnsOptions {
  /**
   * When true, a closed sidebar preference (`sidebar === 0`) contributes zero
   * grid width instead of the compact rail. AppFrame uses this below
   * SIDEBAR_PHONE so the drawer does not reserve a track.
   */
  hideClosedSidebar?: boolean
}

// Contract-frozen geometry: the three-column concession chain's fixed points.
/** Center column floor; only the final fallback may go below it. */
export const CENTER_MIN = 640
/** Sidebar drag clamp floor. */
export const SIDEBAR_MIN = 264
/** Sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 420
/** Sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Closed-sidebar rail: a 24px icon column between 16px horizontal paddings. */
export const SIDEBAR_COLLAPSED = 56
/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
 * LG breakpoint); a manual toggle below it re-expands over the squeezed center
 * (stores.ts narrowExpanded). */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/**
 * Viewport width below which a closed sidebar hides completely (grid width 0)
 * and AppFrame opens it as an overlay drawer instead of the 56px rail.
 * Matches other phone forms (onboarding / workflow panels).
 */
export const SIDEBAR_PHONE = 560
/** Details drag clamp floor. */
export const DETAILS_MIN = 300
/** Details drag clamp ceiling. */
export const DETAILS_MAX = 520
/** Details width before any user drag. */
export const DETAILS_DEFAULT = 360

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * Solve the three column widths for one viewport frame. Pure: no hysteresis —
 * the output is a function of (viewport, preferences, options) only, so
 * recovery on re-widening is automatic. Preferences re-clamp here because
 * they cross the store boundary and callers may still supply stale ranges.
 * @param viewport - available frame width in px.
 * @param sidebar - sidebar width preference in px (0 = closed).
 * @param details - details width preference in px (0 = closed).
 * @param options - closed-sidebar resolution; omit for the compact rail.
 * @returns resolved widths; details 0 means visually closed (never unmounted).
 */
export function computeColumns(
  viewport: number,
  sidebar: number,
  details: number,
  options: ComputeColumnsOptions = {},
): Columns {
  // The sidebar is fixed at its preference (rail, hidden, or open) — it never concedes.
  const s = sidebar === 0
    ? (options.hideClosedSidebar === true ? 0 : SIDEBAR_COLLAPSED)
    : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)

  // Step 1: everything fits at preferred widths.
  if (s + d0 + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s - d0, details: d0 }

  // Step 2: shrink details toward its minimum.
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - CENTER_MIN)
  if (s + d1 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: d1 }

  // Step 3: auto-close details (derived — preferences untouched); center
  // absorbs any remaining deficit (may drop below CENTER_MIN).
  return { sidebar: s, center: Math.max(0, viewport - s), details: 0 }
}
