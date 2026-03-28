# Multi-Area Drawer Navigation Design

## Goal

Expand AlpNav from a single-resort Zillertal Arena build into a multi-area shell where the left drawer becomes the primary area navigator.

## Context

- The current MVP is map browsing first, starting with Zillertal Arena.
- The project notes explicitly defer a full multi-resort shell for the first MVP, but the current product step is to begin expansion in small, verifiable increments.
- The existing top-left drawer is already reserved for app-level navigation, settings, and info, so it is the right place to introduce area switching.
- The reference material points toward a broader Zillertal experience rather than a one-off Arena product.

This change should be treated as the next expansion step in the product roadmap, without assuming every remaining MVP checklist item is already complete.

## Product Decision

- Show all four major Zillertal ski areas in the left drawer from the first multi-area-shell release.
- In the first shell release, only Zillertal Arena is selectable; the other areas are visible as disabled `Coming soon` entries.
- Mayrhofner Bergbahnen is the next area to become live and selectable once its data and assets are wired.
- This spec defines the multi-area shell release. Mayrhofner Bergbahnen becoming live is the immediate follow-up increment enabled by this shell, not part of the shell acceptance bar itself.

## Scope

### In scope

- A shared area registry that defines all Zillertal ski areas shown in the app.
- Drawer navigation UI for switching between available areas.
- Visual indication of the active area.
- Disabled states for not-yet-implemented areas.
- Refactoring the current Arena-specific map boot flow so it can load the active area from shared metadata.
- Defining Mayrhofner Bergbahnen as the next area to activate once the shell is in place.

### Out of scope

- Search across areas.
- A separate valley overview map as a first-class browsing mode.
- User location or route planning across resorts.
- Advanced cross-area state persistence.
- Reworking the bottom bar or info sheet interaction model beyond what area switching requires.

## Area List

The drawer should list these areas from the start:

1. Zillertal Arena
2. Mayrhofner Bergbahnen
3. Ski & Gletscherwelt Zillertal 3000
4. Hochzillertal-Hochfugen-Spieljoch

These four entries are the complete major-area list that should appear in the drawer for this step.

Initial shell-release availability state:

- `Zillertal Arena`: available
- `Mayrhofner Bergbahnen`: coming soon in the first shell release; next live area
- `Ski & Gletscherwelt Zillertal 3000`: coming soon
- `Hochzillertal-Hochfugen-Spieljoch`: coming soon

## UX Design

### Drawer role

The drawer shifts from being mostly informational to being area-navigation first. The current area metadata remains visible, but the main action inside the drawer is choosing where to browse.

### Area item behavior

- Available areas are pressable.
- The active area is visibly highlighted.
- Selecting a different available area closes the drawer and loads that area's map.
- Selecting the already active area closes the drawer without extra work.
- On app load, the shell defaults to Zillertal Arena until the user switches to another available area.
- Coming-soon areas are visible but disabled.
- Disabled areas should communicate status passively with label and styling, not with toast noise or modal interruptions.

### Current area metadata

The drawer header and metadata block should come from the active area's shared metadata rather than hardcoded Arena copy. That includes:

- display name
- location label
- elevation label
- external conditions link

For this step, every listed area must have complete drawer metadata even if the area is still coming soon. Minimum required metadata per area:

- display name
- short subtitle or status line
- location label
- elevation label
- conditions link or a deliberate fallback link target

## Technical Design

### Shared area registry

Introduce a central registry that defines each area's:

- stable id
- display name and short name
- subtitle/status line for the drawer
- availability state
- metadata for header display
- panorama manifest
- overlay data loader

This registry becomes the single source of truth for both the drawer UI and the map-loading logic.

### Map loading model

`MapShell` should own the current area id and derive the active area definition from the registry.

For this step, area selection is in-memory UI state only. It is not encoded in the URL path or query string yet, so refresh and share behavior should continue to land on the default area until a later routing-specific increment is defined.

When the active area changes:

- the map manifest changes
- the overlay data loader changes
- the Pixi scene is rebuilt for the new area
- any selected feature and transient map UI state are reset

This keeps the implementation simple and avoids trying to hot-swap many internal overlay containers in place.

### Data adapters

Each area should expose the same adapter contract that returns `ResortOverlayData`. Zillertal Arena becomes the first registered adapter instead of the hardcoded default path. Mayrhofner Bergbahnen follows the same contract so future areas can slot into the same system.

## Error Handling

- If an area is marked unavailable, it should never trigger a map load.
- If an available area's assets fail to load, the app should fail visibly in development and remain debuggable rather than silently hiding the problem.
- Area switching should clear stale selected items so the info sheet never shows data from a previous area.

## Testing Strategy

Because the project currently has no automated test harness, verification should focus on lint, build, and browser checks.

Required verification:

### Phase 1: multi-area shell

This is the primary acceptance target for this spec.

- `pnpm lint`
- `pnpm build`
- mobile-first manual verification at `390x844`
- confirm the drawer lists all areas
- confirm only implemented areas are selectable
- confirm the app boots into Zillertal Arena by default
- confirm selecting the active area is stable and closes the drawer cleanly

### Phase 2: Mayrhofner Bergbahnen live

This is the immediate follow-up increment enabled by the shell, not the completion bar for the shell release itself.

- `pnpm lint`
- `pnpm build`
- mobile-first manual verification at `390x844`
- confirm switching between Arena and Mayrhofner Bergbahnen works
- confirm switching areas resets selection and map-specific transient state
- confirm current-area metadata updates with the selected area

## Incremental Delivery Plan

1. Introduce the shared area registry and keep Zillertal Arena as the only selectable area.
2. Update the drawer to render all four areas, with Mayrhofner Bergbahnen, Zillertal 3000, and Hochzillertal-Hochfugen-Spieljoch disabled as `Coming soon`.
3. Verify the shell boots into Zillertal Arena and preserves the current Arena browsing flow.
4. Add Mayrhofner Bergbahnen assets and adapter wiring.
5. Mark Mayrhofner Bergbahnen as available and verify switching between the two live areas.

## Why This Direction

- It keeps expansion tightly scoped to the next useful product step.
- It establishes the final navigation model now instead of repeatedly reworking the drawer.
- It preserves the existing mobile-first interaction model.
- It creates a reusable foundation for additional Zillertal areas without committing to broad cross-resort features too early.
