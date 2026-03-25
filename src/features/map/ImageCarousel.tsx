import { useState, useEffect, useRef } from "react";

type Props = {
  imageUrls: string[];
  alt: string;
  onOpenLightbox: () => void;
  onIndexChange?: (index: number) => void;
};

export function ImageCarousel({ imageUrls, alt, onOpenLightbox, onIndexChange }: Props) {
  const n = imageUrls.length;

  // For n > 1: strip is [last, img0, img1, ..., imgN-1, first]
  // stripIndex 1..n maps to the real images; 0 and n+1 are clones for looping
  const [stripIndex, setStripIndex] = useState(n > 1 ? 1 : 0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const axisLocked = useRef<"h" | "v" | null>(null);

  // Logical index (0-based) for dots and callbacks
  const imgIndex = n > 1 ? (stripIndex - 1 + n) % n : 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStripIndex(n > 1 ? 1 : 0);
    setSkipTransition(true);
    onIndexChange?.(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrls]);

  // Re-enable transition after the instant-jump render has painted
  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  function navigate(next: number) {
    setStripIndex(next);
    const nextImg = n > 1 ? (next - 1 + n) % n : 0;
    onIndexChange?.(nextImg);
  }

  // After animating to a clone, instantly jump to the real counterpart
  function handleTransitionEnd() {
    if (n <= 1) return;
    if (stripIndex === 0) {
      setSkipTransition(true);
      setStripIndex(n);
      onIndexChange?.(n - 1);
    } else if (stripIndex === n + 1) {
      setSkipTransition(true);
      setStripIndex(1);
      onIndexChange?.(0);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    axisLocked.current = null;
    setDragging(true);
    setDragOffset(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }

    if (axisLocked.current === "h") {
      e.preventDefault();
      setDragOffset(dx);
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    setDragging(false);
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    if (axisLocked.current === "h" && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
      e.stopPropagation();
      navigate(dx < 0 ? stripIndex + 1 : stripIndex - 1);
    }
    setDragOffset(0);
  }

  function handleClick() {
    if (!didSwipe.current) onOpenLightbox();
  }

  const strip = n > 1
    ? [imageUrls[n - 1], ...imageUrls, imageUrls[0]]
    : imageUrls;

  const translateX = `calc(${(-stripIndex * 100) / strip.length}% + ${dragOffset}px)`;

  return (
    <div>
      <div
        className="relative w-full h-[220px] overflow-hidden rounded-xl cursor-pointer"
        onClick={handleClick}
        onTouchStart={n > 1 ? handleTouchStart : undefined}
        onTouchMove={n > 1 ? handleTouchMove : undefined}
        onTouchEnd={n > 1 ? handleTouchEnd : undefined}
      >
        <div
          className="flex h-full"
          style={{
            width: `${strip.length * 100}%`,
            transform: `translateX(${translateX})`,
            transition: dragging || skipTransition ? "none" : "transform 280ms ease-out",
            willChange: "transform",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {strip.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={i === (n > 1 ? 1 : 0) ? alt : ""}
              className="h-full object-cover"
              style={{ width: `${100 / strip.length}%` }}
              draggable={false}
            />
          ))}
        </div>

        {n > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm"
              onClick={e => { e.stopPropagation(); navigate(stripIndex - 1); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm"
              onClick={e => { e.stopPropagation(); navigate(stripIndex + 1); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1 mt-1">
          {imageUrls.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIndex ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
