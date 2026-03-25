# Carousel Skeleton Loader — Design Spec

**Date:** 2026-03-25
**Branch:** info-sheet-image-skeleton-loader
**Status:** Approved

---

## Problem

When an info sheet item with images is selected, the `ImageCarousel` renders `<img>` tags immediately but the images take time to download. During this time the carousel area is blank, creating a jarring flash of empty space.

## Goal

Show a single skeleton placeholder with a horizontal shimmer sweep over the full carousel area while the first visible image is loading, then crossfade it out once the image has loaded.

---

## Approach: Skeleton Overlay (Option A)

An absolutely-positioned skeleton `<div>` is layered on top of the existing carousel container. It fades out via CSS opacity transition when the first image fires `onLoad`. No structural changes to the strip logic or `InfoSheet`.

---

## Component Changes

### `ImageCarousel.tsx`

**New state:**
```ts
const [loaded, setLoaded] = useState(false);
```

**New ref** — used to detect cache hits (see below):
```ts
const firstImgRef = useRef<HTMLImageElement>(null);
```

**Reset on `imageUrls` change** — add `setLoaded(false)` to the existing `useEffect` that resets `stripIndex` (the one with `[imageUrls]` dependency). This ensures the skeleton re-appears when the user navigates to a different item.

**`onLoad` handler** — the strip array is constructed as:
```ts
const strip = n > 1
  ? [imageUrls[n - 1], ...imageUrls, imageUrls[0]]
  : imageUrls;
```
The first real image (`imageUrls[0]`) sits at array index `1` for multi-image carousels, and at index `0` for single-image. In the `.map((url, i) => ...)` over `strip`, attach both `ref={firstImgRef}` and `onLoad={() => setLoaded(true)}` to the `<img>` where `i === (n > 1 ? 1 : 0)`. No handler on the other strip items.

**Cache-hit guard** — when a browser serves an image from HTTP cache, `onLoad` fires synchronously during render before React has attached the handler, meaning `loaded` never becomes `true` and the skeleton never disappears. Fix this with a `useEffect`:
```ts
useEffect(() => {
  if (firstImgRef.current?.complete) setLoaded(true);
}, [imageUrls]);
```
This runs after every `imageUrls` change and immediately clears the skeleton if the target image is already decoded.

**Skeleton element** — placed inside the carousel container `<div>` (the one with `h-[220px] overflow-hidden rounded-xl`), after the strip `<div>`:
```tsx
<div
  className={`absolute inset-0 rounded-xl bg-[#07111f] pointer-events-none transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
  aria-hidden="true"
>
  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />
</div>
```

**Known trade-off:** after `loaded` is true the skeleton div remains in the DOM as a fully transparent, non-interactive node. It is intentionally left in place to avoid the complexity of a second `transitionend` state. Because `pointer-events-none` is always applied and the element is `aria-hidden`, this has no functional impact.

---

### Global CSS (`globals.css`)

This project uses Tailwind CSS 4, which does not use `tailwind.config.ts`. Add the keyframe and utility class directly in `globals.css`:

```css
@keyframes shimmer {
  from { background-position: 200% center; }
  to   { background-position: -200% center; }
}

@layer utilities {
  .animate-shimmer {
    animation: shimmer 1.4s ease-in-out infinite;
  }
}
```

---

## Constraints

- Changes scoped to `ImageCarousel.tsx` and `globals.css` only.
- No changes to `InfoSheet.tsx`.
- The skeleton uses the same background color as the sheet card (`#07111f`) to avoid color mismatch.
- `pointer-events-none` ensures the skeleton never blocks carousel interaction even while fading.

---

## Out of Scope

- Per-image skeletons for subsequent images in the strip.
- Skeleton for the webcam thumbnail in `InfoSheet` (separate component).
- Error states for failed image loads.
- Removing the skeleton node from the DOM post-fade (acknowledged trade-off above).
