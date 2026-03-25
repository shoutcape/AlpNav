# Carousel Skeleton Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a shimmer skeleton placeholder over the image carousel while the first image loads, then crossfade it out once loaded.

**Architecture:** An absolutely-positioned `<div>` overlay sits on top of the existing carousel container. A `loaded` boolean state controls its opacity. A `useEffect` cache-hit guard handles images that are already in browser cache. The shimmer animation is a CSS keyframe added to `globals.css`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Next.js App Router

---

## Files

| Action | Path | What changes |
|--------|------|--------------|
| Modify | `src/features/map/ImageCarousel.tsx` | Add `loaded` state, `firstImgRef`, cache-hit guard, `onLoad` on first strip image, skeleton overlay element |
| Modify | `src/app/globals.css` | Add `@keyframes shimmer` and `.animate-shimmer` utility class |

---

### Task 1: Add shimmer keyframe and utility class

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add keyframe and utility to `globals.css`**

Append to the end of `src/app/globals.css`:

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

- [ ] **Step 2: Verify build passes**

```bash
pnpm build
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add shimmer keyframe for skeleton loader"
```

---

### Task 2: Add skeleton overlay to ImageCarousel

**Files:**
- Modify: `src/features/map/ImageCarousel.tsx`

- [ ] **Step 1: Add `loaded` state and `firstImgRef`**

At the top of the `ImageCarousel` function body, alongside the existing `useState` calls (after line 18, `const axisLocked = useRef...`), add:

```ts
const [loaded, setLoaded] = useState(false);
const firstImgRef = useRef<HTMLImageElement>(null);
```

- [ ] **Step 2: Reset `loaded` when `imageUrls` changes**

In the existing `useEffect` that resets `stripIndex` (the one with `[imageUrls]` dependency, currently lines 27–33), add `setLoaded(false)` inside the effect body:

```ts
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setStripIndex(n > 1 ? 1 : 0);
  setSkipTransition(true);
  setLoaded(false);
  onIndexChange?.(0);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [imageUrls]);
```

- [ ] **Step 3: Add cache-hit guard `useEffect`**

Add a new `useEffect` after the existing ones (after the `skipTransition` effect, before `navigate`):

```ts
useEffect(() => {
  if (firstImgRef.current?.complete) setLoaded(true);
}, [imageUrls]);
```

This handles images already in the browser's HTTP cache, where `onLoad` fires before React attaches the handler.

- [ ] **Step 4: Attach `ref` and `onLoad` to the first real strip image**

The current `strip.map` renders all images identically. Update it to attach `ref` and `onLoad` only to the first real image — the one at array index `n > 1 ? 1 : 0`:

```tsx
{strip.map((url, i) => (
  <img
    key={i}
    ref={i === (n > 1 ? 1 : 0) ? firstImgRef : undefined}
    onLoad={i === (n > 1 ? 1 : 0) ? () => setLoaded(true) : undefined}
    src={url}
    alt={i === (n > 1 ? 1 : 0) ? alt : ""}
    className="h-full object-cover"
    style={{ width: `${100 / strip.length}%` }}
    draggable={false}
  />
))}
```

- [ ] **Step 5: Add skeleton overlay element**

Inside the carousel container `<div>` (the one with `relative w-full h-[220px] overflow-hidden rounded-xl cursor-pointer`), after the strip `<div>` and before the nav buttons, add:

```tsx
<div
  className={`absolute inset-0 rounded-xl bg-[#07111f] pointer-events-none transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
  aria-hidden="true"
>
  <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />
</div>
```

- [ ] **Step 6: Verify TypeScript and build**

```bash
pnpm build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 7: Manual verification**

Run the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser at 390×844 viewport (iPhone 12 Pro).

1. Select a map item that has images (e.g. a lift or gastronomy spot with `imageUrls`).
2. The carousel area should show a dark background with a horizontal shimmer sweep while the image loads.
3. Once the image loads, the skeleton fades out (300 ms opacity transition) and the image is visible.
4. Select a different item — the skeleton should reappear.
5. Select the same item again — the skeleton should appear briefly or not at all (cache hit), never hanging permanently.
6. Select an item with a single image — skeleton should behave identically.

- [ ] **Step 8: Commit**

```bash
git add src/features/map/ImageCarousel.tsx
git commit -m "feat: add skeleton loader overlay to ImageCarousel"
```
