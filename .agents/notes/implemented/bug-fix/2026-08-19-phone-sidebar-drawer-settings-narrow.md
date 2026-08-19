# Agent Note: Phone sidebar drawer and Settings narrow layout

Status: implemented

English | [中文](2026-08-19-phone-sidebar-drawer-settings-narrow.zh.md)

## Problem

On a phone-width Web UI, the closed sidebar still reserved the 56px control rail, which stole horizontal space from the conversation and left long tool/permission labels clipped. The Settings modal kept a fixed 188px side nav beside the content column inside `max-width: calc(100vw - 48px)`, so option titles wrapped into single-character columns and controls overlapped. After the drawer landed, the conversation header still sat under the top-left open control, and the composer trailing chips (model name + effort) did not collapse with the permission chips.

## Decision

**Below `SIDEBAR_PHONE` (560px) a closed sidebar contributes zero grid width; AppFrame owns a top-left open control and paints an open sidebar as an overlay drawer with a dismiss mask. Below the same breakpoint the Settings panel stacks a horizontal scrollable section nav above the content column. Conversation chrome and the composer tool row also tighten at that width / at the InputBar 460px container query.**

- `computeColumns` accepts `hideClosedSidebar`; AppFrame always passes a closed preference on phone so the grid track stays 0 whether the drawer is open or closed.
- Tablet widths (`SIDEBAR_PHONE` … `SIDEBAR_AUTO_COLLAPSE`) keep the existing auto-collapse rail and squeeze-to-expand behavior.
- The phone open control and mask aria labels are Chinese product copy owned by the frame (this package has no locale seat).
- Settings layout is CSS-only (`@media (max-width: 560px)`); section content plugins are unchanged.
- Conversation header left padding clears the open control; ModelSelect hides effort and shortens the chip via `@container` (same InputBar row as PermissionSelect); ContextMeter panels clamp to the viewport; Hero headline and composer side clearance shrink slightly.

## Alternatives considered

**Squeeze the open sidebar into the grid on phone.** Rejected: a ~280px preference on a ~390px viewport leaves an unusable center column.

**Keep the 56px rail and only add a header toggle.** Rejected: the rail is the space complaint; hiding it is the requirement.

**Register the phone open control from ui-sidebar into `shell.overlay`.** Rejected for this change: the overlay registrant cannot read the layout store's collapsed override without a new cross-plugin face; the frame already owns phone geometry.

**Phone overlay for the chat Details column.** Deferred: needs AppFrame or center-column hosting like the trajectory details mask; out of scope for chrome polish.

## Consequences

Opening Settings on phone still requires opening the drawer first (the trigger lives in the sidebar foot). LAN / non-loopback Settings privilege failures (`settings.describe` 403) remain Host policy, not a layout bug. English locale gets Chinese aria on the phone open/mask controls until the frame gains a locale seat. Chat Details still auto-closes to zero width under the desktop concession chain on phone.

## Required verification

- `packages/client/ui-layout/tests/columns.client.spec.ts` — `hideClosedSidebar` zero width.
- `packages/client/ui-layout/tests/app-frame.client.spec.tsx` — phone hide, drawer open, mask dismiss.
- `pnpm run test:gui` covering ui-layout, ui-settings-general, ui-conversation, and ui-model-selection.
