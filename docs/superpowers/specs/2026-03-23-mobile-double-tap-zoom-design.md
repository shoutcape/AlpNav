# Mobile Double-Tap Zoom — Design Spec

**Date:** 2026-03-23
**Branch:** feat/mobile-double-tap-zoom
**Status:** Ready for implementation

---

## Summary

Add standard mobile double-tap zoom to the Pixi.js panorama map. Each double-tap zooms in 2× centered on the tap point, matching the behavior of Google Maps and Apple Maps.

---

## Scope

- **In scope:** double-tap detection on the map canvas; animated 2× zoom centering the tapped world point; suppression of single-tap hit-test on the second tap
- **Out of scope:** double-tap-and-hold continuous zoom; zoom-out on double-tap; changes to pinch or wheel zoom; DOM-level `click` suppression (pixi-viewport uses pointer events, not browser `click`)

---

## Approach

Native `touchend` listener on the Pixi canvas. pixi-viewport's drag/pinch/wheel handling is pointer-event based, so a `touchend` listener coexists without conflict. Registered `{ passive: true }` because it never calls `preventDefault()`.

---

## Detection

### New refs (declared with the existing ref block before the setup `useEffect`)

| Ref | Type | Purpose |
|-----|------|---------|
| `lastTapRef` | `{ time: number; x: number; y: number } \| null` | Screen position and timestamp of the most recent qualifying single tap |
| `suppressNextClickRef` | `boolean` | When `true`, the `"clicked"` handler skips the hit-test for that event |
| `suppressTimeoutRef` | `ReturnType<typeof setTimeout> \| null` | Stores the ID of the safety-reset timeout so it can be cancelled |

### `touchend` handler logic

The handler must be assigned to a named variable (`const handleTouchEnd = ...`) before being passed to `addEventListener`, so the same reference can be passed to `removeEventListener` in the cleanup function.

```
1. if changedTouches.length !== 1 → return      // reject multi-finger lift
2. if touches.length !== 0 → return             // reject if any finger still down (pinch guard)
3. read clientX, clientY from changedTouches[0]
4. if lastTapRef is set:
     elapsed = performance.now() - lastTapRef.time
     dist = Math.hypot(clientX - lastTapRef.x, clientY - lastTapRef.y)
     if elapsed < 300 AND dist < 30:
       → double-tap confirmed
       lastTapRef = null
       if vp.scale.x < maxScale:
         set suppressNextClickRef = true
         suppressTimeoutRef = setTimeout(() => {
           suppressNextClickRef = false;
           suppressTimeoutRef = null;
         }, 500)
         call doZoom(clientX, clientY)
       // At max zoom: no suppression, no animation; second tap will fire hit-test normally.
       // lastTapRef is null, so the second tap cannot seed a new double-tap window.
       return
5. lastTapRef = { time: performance.now(), x: clientX, y: clientY }
```

**Notes:**
- Step 2 ensures a pinch-end (one finger still down when the other lifts) is rejected.
- At max zoom the handler returns without setting `suppressNextClickRef`, so the hit-test fires normally on the second tap. The second tap does not start a new double-tap window because `lastTapRef` is cleared.
- Rapid chaining (triple-tap, etc.): after each confirmed double-tap `lastTapRef` is cleared; each subsequent tap begins a fresh window. Two sequential zooms from three fast taps is acceptable map behavior.
- UI overlays (bottom bar, FilterPanel, InfoSheet) sit in sibling DOM branches to the canvas. A touch that lands on an overlay element hits that element and bubbles up through its own ancestors — it never reaches the canvas listener. No `stopPropagation` is needed.
- No CSS `zoom` or `transform: scale` is applied to the canvas or any of its DOM ancestors; `getBoundingClientRect()` gives correct results.

---

## Zoom Behavior

### Coordinate space

`autoDensity: true` is set on the Pixi Application, so the canvas's CSS dimensions equal its Pixi coordinate space — no DPR conversion is needed. `viewport.toWorld(localX, localY)` accepts CSS pixel canvas-local coordinates.

### `viewport.animate()` position semantics

Confirmed against pixi-viewport v6 source: the `position` option in `animate()` calls `viewport.moveCenter(position)` internally, centering the given world point on screen. Combined with a scale change, the tapped world point becomes the new viewport center after the zoom — the standard double-tap map behavior.

### `doZoom` implementation

```ts
function doZoom(clientX: number, clientY: number) {
  const vp = viewportRef.current;
  const canvas = appRef.current?.canvas;
  if (!vp || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  const worldPoint = vp.toWorld(localX, localY);
  const newScale = Math.min(vp.scale.x * 2, maxScale);
  // newScale >= vp.scale.x (zooming in only) and <= maxScale.
  // viewport.clampZoom is already configured; animate() respects it.
  // minScale clamping is not needed: 2× from any valid scale stays above minScale.

  vp.animate({
    scale: newScale,
    position: worldPoint,   // world point to center on screen after zoom
    time: 300,
    ease: "easeInOutQuad",
  });
}
```

`doZoom` is only called when `vp.scale.x < maxScale`, so `newScale` is always strictly greater than the current scale.

---

## Single-Tap Suppression

pixi-viewport emits `"clicked"` for every non-drag touch. The suppression guard is added at the top of the existing handler. When it fires, it also cancels the safety timeout (preventing the timeout from clearing a flag that was legitimately re-set by a subsequent double-tap):

```ts
viewport.on("clicked", ({ world }) => {
  if (suppressNextClickRef.current) {
    suppressNextClickRef.current = false;
    clearTimeout(suppressTimeoutRef.current ?? undefined);
    suppressTimeoutRef.current = null;
    return;
  }
  setFilterPanelOpen(false);
  setLegendOpen(false);
  // ... existing hit-test logic
});
```

**Ordering guarantee:** `touchend` fires before `pointerup` on all major mobile browsers. pixi-viewport's `"clicked"` is triggered by `pointerup`. Therefore `suppressNextClickRef` is set before `"clicked"` fires — the guard always runs after the flag is set.

---

## Implementation Location

All changes confined to `src/features/map/MapShell.tsx`:

1. Three new refs (`lastTapRef`, `suppressNextClickRef`, `suppressTimeoutRef`) in the existing ref block.
2. Named `handleTouchEnd` function + `doZoom` helper defined and registered inside the setup `useEffect`; `removeEventListener(handleTouchEnd)` called in the cleanup return.
3. `"clicked"` handler updated with the suppression guard and timeout cancellation.

No new files. No new components.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Double-tap at max zoom | No animation, no suppression; second tap fires hit-test; lastTapRef cleared (no new window seeded) |
| Double-tap during pinch | `touches.length !== 0` guard rejects the tap |
| Rapid triple-tap | After the double-tap zoom, third tap seeds a new window; a fourth tap within 300ms zooms again — acceptable chaining behavior |
| Double-tap on UI overlay | Overlays are in separate DOM branches; `touchend` never reaches the canvas listener |
| `suppressNextClickRef` stuck `true` | 500ms timeout clears it; restores normal single-tap behavior |
| Timeout-vs-"clicked" race | "clicked" handler cancels the pending timeout when it clears the flag; no cross-contamination with subsequent double-taps |
| Stale `lastTapRef` | Elapsed check fails; record is overwritten by the next tap — benign |

---

## Testing Checklist

- [ ] Double-tap zooms in 2× with the tapped point centered on screen (390×844)
- [ ] Zoom animation is smooth (~300ms, no jump)
- [ ] Single tap correctly selects overlay items
- [ ] Double-tap does not select an overlay item
- [ ] Single tap immediately after a double-tap correctly selects items (no stale suppression)
- [ ] Double-tap at max zoom: no animation, and second tap still runs the hit-test
- [ ] Pinch zoom works normally before and after a double-tap
- [ ] Double-tap on UI overlays (bottom bar, filter panel, info sheet) has no effect on the map
