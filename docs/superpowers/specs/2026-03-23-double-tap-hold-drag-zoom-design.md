# Double-Tap Hold-Drag Zoom — Design Spec

**Date:** 2026-03-23
**Branch:** feat/mobile-double-tap-zoom
**Status:** Ready for implementation

---

## Summary

Extend the existing double-tap snap zoom: when the user holds on the second tap and drags vertically, the map scale adjusts continuously in real time. Dragging **up** zooms in; dragging **down** zooms out. The world point under the initial tap stays pinned at its original screen position throughout the drag. Releasing with minimal movement (< 20px) falls back to the existing 2× snap zoom. Matches Google Maps / Apple Maps hold-drag behavior.

---

## Scope

- **In scope:** hold detection on second `touchstart`; continuous scale on `touchmove`; focal point pinned to tap screen position; bounds clamping; drag plugin pause/resume; click suppression on release; snap-zoom fallback for minimal-drag double-taps
- **Out of scope:** changes to quick double-tap snap zoom; pinch; wheel

---

## New state

One new `useRef` declared alongside the existing refs:

```ts
const dragZoomRef = useRef<{
  startY: number;
  startScale: number;
  worldX: number;
  worldY: number;
  screenX: number;  // canvas-local px (clientX - rect.left)
  screenY: number;  // canvas-local px (clientY - rect.top)
} | null>(null);
```

`dragZoomRef.current !== null` means drag-zoom is active.

Two new outer-scope let variables alongside `wheelPanHandler` / `touchEndHandler`:

```ts
let touchStartHandler: ((e: TouchEvent) => void) | null = null;
let touchMoveHandler:  ((e: TouchEvent) => void) | null = null;
```

---

## `touchStartHandler` (passive)

```
1. if e.touches.length > 1:
     dragZoomRef.current = null
     viewportRef.current?.plugins.resume("drag")
     // No suppressNextClick needed — multi-touch abort does not produce a "clicked" event.
     return

2. if e.touches.length !== 1 → return

3. const { clientX, clientY } = e.touches[0]

4. if lastTapRef.current is set AND
      performance.now() - lastTapRef.current.time < 300 AND
      Math.hypot(clientX - lastTapRef.current.x, clientY - lastTapRef.current.y) < 30:

     const vp = viewportRef.current
     const canvas = appRef.current?.canvas
     if (!vp || !canvas) return       // bail before touching any state

     const rect = canvas.getBoundingClientRect()
     const sx = clientX - rect.left
     const sy = clientY - rect.top
     const wp = vp.toWorld(sx, sy)
     // autoDensity:true → CSS px = Pixi coord space; no DPR adjustment needed.

     lastTapRef.current = null        // cleared only after validation passes
     dragZoomRef.current = {
       startY: clientY,
       startScale: vp.scale.x,
       worldX: wp.x,
       worldY: wp.y,
       screenX: sx,
       screenY: sy,
     }
     vp.plugins.pause("drag")        // prevent pixi-viewport pan during drag-zoom
```

---

## `touchMoveHandler` (passive)

`passive: true` is safe because pan suppression is handled via `vp.plugins.pause("drag")` — no `preventDefault()` needed. The canvas container is `overflow: hidden` so native scroll is not triggered.

```
1. if !dragZoomRef.current → return
2. if e.touches.length !== 1 → return
3. const vp = viewportRef.current; if (!vp) return

4. deltaY = e.touches[0].clientY - dragZoomRef.current.startY
   // UP drag (negative deltaY) → -deltaY positive → 2^positive > 1 → zoom in
   // DOWN drag (positive deltaY) → -deltaY negative → 2^negative < 1 → zoom out

5. newScale = clamp(
     dragZoomRef.current.startScale * Math.pow(2, -deltaY / 100),
     minScaleRef.current,
     maxScale
   )

6. vp.scale.set(newScale)

7. // Pin tap world point to its original screen position:
   // screen_x = vp.x + worldX * scale  →  vp.x = screenX - worldX * newScale
   vp.x = dragZoomRef.current.screenX - dragZoomRef.current.worldX * newScale
   vp.y = dragZoomRef.current.screenY - dragZoomRef.current.worldY * newScale

8. // Clamp vp.x/vp.y to world bounds — exact same logic as wheelPanHandler
   // (direct x/y mutation bypasses the plugin pipeline):
   const scaledW = vp.worldWidth  * newScale
   const scaledH = vp.worldHeight * newScale
   vp.x = scaledW >= vp.screenWidth
     ? Math.min(0, Math.max(vp.screenWidth - scaledW, vp.x))
     : (vp.screenWidth - scaledW) / 2
   vp.y = scaledH >= vp.screenHeight
     ? Math.min(0, Math.max(vp.screenHeight - scaledH, vp.y))
     : (vp.screenHeight - scaledH) / 2
   // minScaleRef.current and maxScale match the values passed to clampZoom(),
   // so the scale range in step 4 is always consistent with the plugin.

9. vp.emit("moved", { type: "drag", viewport: vp })
   // The "moved" listeners (syncLevelBlend, syncLabelTiers, redrawDebug) do not
   // discriminate on `type`; any non-null type string triggers them correctly.
```

---

## `touchEndHandler` update

Insert at the **very top** of the existing handler, before all existing logic:

```ts
if (dragZoomRef.current !== null) {
  const dz = dragZoomRef.current;
  dragZoomRef.current = null;
  viewportRef.current?.plugins.resume("drag");

  const { clientX, clientY } = e.changedTouches[0];
  const deltaY = Math.abs(clientY - dz.startY);

  // Suppress the "clicked" hit-test on release — whether the gesture was a drag or
  // a quick hold. This prevents accidentally selecting an overlay item on finger lift.
  if (suppressTimeoutRef.current !== null) clearTimeout(suppressTimeoutRef.current);
  suppressNextClickRef.current = true;
  suppressTimeoutRef.current = setTimeout(() => {
    suppressNextClickRef.current = false;
    suppressTimeoutRef.current = null;
  }, 500);

  // Quick hold (|deltaY| < 20px) → fall back to snap zoom (always zooms IN).
  // Incidental downward drift on a genuine double-tap is within this threshold
  // and is treated as zoom-in intent, which is the correct user expectation.
  // doZoom() accepts raw clientX/clientY and subtracts rect internally.
  // At maxScale, doZoom is skipped — gesture is a no-op beyond click suppression.
  if (deltaY < 20 && viewportRef.current && viewportRef.current.scale.x < maxScale) {
    doZoom(clientX, clientY);
  }
  return;
}
// existing lastTapRef / snap-zoom logic unchanged below...
```

---

## Registration and cleanup

Both listeners are added to `app.canvas`. The canvas fills the full screen (`absolute inset-0`), so a vertical drag will not drift outside it.

```ts
app.canvas.addEventListener("touchstart", touchStartHandler, { passive: true });
app.canvas.addEventListener("touchmove",  touchMoveHandler,  { passive: true });
// touchend already registered on app.canvas
```

Cleanup additions in the useEffect return (alongside existing wheel and touchend cleanup):

```ts
if (touchStartHandler && appRef.current?.canvas) {
  appRef.current.canvas.removeEventListener("touchstart", touchStartHandler);
}
if (touchMoveHandler && appRef.current?.canvas) {
  appRef.current.canvas.removeEventListener("touchmove", touchMoveHandler);
}
// Ensure drag plugin is restored if component unmounts mid-drag:
viewportRef.current?.plugins.resume("drag");
```

Cleanup order does not matter — removing event listeners and calling `resume` are both idempotent.

---

## Edge cases

| Scenario | Behavior |
|----------|----------|
| Quick double-tap (|deltaY| < 20px) | Drag path exits → `doZoom()` fires snap zoom |
| Hold with no drag, at max zoom | `deltaY < 20` but `scale >= maxScale` → no snap zoom; click suppressed; no-op |
| Slow drag | Drag zoom runs; release suppresses click; no snap zoom |
| Second finger added mid-drag | `touchStartHandler` step 1 clears state, resumes drag plugin; pixi-viewport pinch takes over; no click suppression |
| Scale hits min/max | `clamp()` holds scale; bounds clamping keeps viewport in range |
| Unmount during drag | Cleanup resumes drag plugin; touch listeners removed |
| Double-tap on UI overlay | Separate DOM branch; canvas never receives events |

---

## Testing Checklist

- [ ] Hold-drag up zooms in continuously; focal point stays fixed at tap position on screen
- [ ] Hold-drag down zooms out continuously; focal point stays fixed
- [ ] Quick double-tap (fast release, no drag) fires the 2× snap zoom with animation
- [ ] Releasing drag-zoom does not select an overlay item
- [ ] Adding a second finger mid-drag transitions to normal pinch zoom cleanly
- [ ] Scale clamps at min and max — no over/under-zoom; viewport stays within world bounds
- [ ] Single tap after drag-zoom release correctly selects overlay items
- [ ] Double-tap at max zoom (slow release): no snap zoom, no hit-test — no-op
- [ ] `pnpm lint` reports 0 errors
