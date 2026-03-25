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

**Reset on `imageUrls` change** (add to the existing `useEffect` that resets `stripIndex`):
```ts
setLoaded(false);
```

**`onLoad` handler on the first real image** — the image at position `stripIndex === 1` for multi-image carousels (or `stripIndex === 0` for single-image). When this fires, set `loaded = true`.

**Skeleton element** — placed inside the carousel container `<div>` (the one with `h-[220px] overflow-hidden rounded-xl`):
```tsx
<div
  className={`absolute inset-0 rounded-xl bg-[#07111f] pointer-events-none transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
  aria-hidden="true"
>
  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />
</div>
```

After the opacity transition completes, the skeleton should no longer intercept any pointer events (handled by `pointer-events-none` already set).

### Global CSS / Tailwind config

Add a `shimmer` keyframe:
```css
@keyframes shimmer {
  from { background-position: 200% center; }
  to   { background-position: -200% center; }
}
```

Register as a Tailwind utility (in `globals.css` using `@layer utilities` or in `tailwind.config.ts`):
```css
.animate-shimmer {
  animation: shimmer 1.4s ease-in-out infinite;
}
```

---

## Constraints

- Changes scoped to `ImageCarousel.tsx` and global CSS only.
- No changes to `InfoSheet.tsx`.
- The skeleton uses the same background color as the sheet card (`#07111f`) to avoid color mismatch.
- `pointer-events-none` ensures the skeleton never blocks carousel interaction even while fading.

---

## Out of Scope

- Per-image skeletons for subsequent images in the strip.
- Skeleton for the webcam thumbnail in `InfoSheet` (separate component).
- Error states for failed image loads.
