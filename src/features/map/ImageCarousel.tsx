import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  imageUrls: string[];
  alt: string;
};

export function ImageCarousel({ imageUrls, alt }: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const validUrls = imageUrls.filter(url => !failedUrls.has(url));
  const n = validUrls.length;

  const [lightboxOpen, setLightboxOpen] = useState(false);

  // For n > 1: strip is [last, img0, img1, ..., imgN-1, first]
  // stripIndex 1..n maps to the real images; 0 and n+1 are clones for looping
  const [stripIndexState, setStripIndexState] = useState(n > 1 ? 1 : 0);
  const stripIndexRef = useRef(stripIndexState);

  function setStripIndex(val: number) {
    stripIndexRef.current = val;
    setStripIndexState(val);
  }

  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const firstImgRef = useRef<HTMLImageElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const axisLocked = useRef<"h" | "v" | null>(null);

  // Logical index (0-based) for dots and callbacks
  const imgIndex = n > 1 ? (stripIndexState - 1 + n) % n : 0;

  useEffect(() => {
    setFailedUrls(new Set());
    const initialN = imageUrls.length;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStripIndex(initialN > 1 ? 1 : 0);
    setSkipTransition(true);
    setLoaded(false);
    setLightboxOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrls]);

  // Adjust carousel if an image fails and the bounds shrink
  useEffect(() => {
    if (n === 0) return;
    if (n === 1 && stripIndexState !== 0) {
      setSkipTransition(true);
      setStripIndex(0);
    } else if (n > 1 && stripIndexState > n) {
      setSkipTransition(true);
      setStripIndex(n);
    }
  }, [n, stripIndexState]);

  // Re-enable transition after the instant-jump render has painted
  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  // Must run after the reset effect above — React guarantees [imageUrls] effects fire in declaration order
  useEffect(() => {
    if (firstImgRef.current?.complete) setLoaded(true);
  }, [validUrls]);

  function navigate(next: number) {
    if (next < 0) {
      setSkipTransition(true);
      setStripIndex(n);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSkipTransition(false);
          setStripIndex(n - 1);
        });
      });
      return;
    }
    if (next > n + 1) {
      setSkipTransition(true);
      setStripIndex(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSkipTransition(false);
          setStripIndex(2);
        });
      });
      return;
    }

    setStripIndex(next);
  }

  // After animating to a clone, instantly jump to the real counterpart
  function handleTransitionEnd() {
    if (n <= 1) return;
    if (stripIndexState === 0) {
      setSkipTransition(true);
      setStripIndex(n);
    } else if (stripIndexState === n + 1) {
      setSkipTransition(true);
      setStripIndex(1);
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    didSwipe.current = false;
    axisLocked.current = null;
    setDragging(true);
    setDragOffset(0);

    if (n > 1) {
      if (stripIndexRef.current === 0) {
        setSkipTransition(true);
        setStripIndex(n);
      } else if (stripIndexRef.current === n + 1) {
        setSkipTransition(true);
        setStripIndex(1);
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;

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

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging(false);
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;

    if (axisLocked.current === "h" && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
      e.stopPropagation();
      navigate(dx < 0 ? stripIndexRef.current + 1 : stripIndexRef.current - 1);
    }
    setDragOffset(0);
  }

  function handlePointerCancel() {
    setDragging(false);
    setDragOffset(0);
  }

  function handleClick() {
    if (!didSwipe.current) setLightboxOpen(true);
  }

  const strip = n > 1
    ? [validUrls[n - 1], ...validUrls, validUrls[0]]
    : validUrls;

  const firstRealIndex = n > 1 ? 1 : 0;

  const translateX = `calc(${(-stripIndexState * 100) / strip.length}% + ${dragOffset}px)`;

  if (n === 0) return null;

  return (
    <>
      <div className="w-full max-w-[400px]">
        <div
          className="relative w-full h-[220px] overflow-hidden rounded-xl cursor-pointer touch-pan-y"
          onClick={handleClick}
          onPointerDown={n > 1 ? handlePointerDown : undefined}
          onPointerMove={n > 1 ? handlePointerMove : undefined}
          onPointerUp={n > 1 ? handlePointerUp : undefined}
          onPointerCancel={n > 1 ? handlePointerCancel : undefined}
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
                key={`${i}-${url}`}
                ref={i === firstRealIndex ? firstImgRef : undefined}
                onLoad={i === firstRealIndex ? () => setLoaded(true) : undefined}
                onError={() => {
                  setSkipTransition(true);
                  setFailedUrls(prev => {
                    const next = new Set(prev);
                    next.add(url);
                    return next;
                  });
                }}
                src={url}
                alt={i === firstRealIndex ? alt : ""}
                className="h-full object-cover"
                style={{ width: `${100 / strip.length}%` }}
                draggable={false}
              />
            ))}
          </div>

          <div
            className={`absolute inset-0 rounded-xl bg-[#07111f] pointer-events-none transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
            aria-hidden="true"
          >
            {!loaded && (
              <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] bg-[length:200%_100%]" />
            )}
          </div>

          {n > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm"
                onClick={e => { e.stopPropagation(); navigate(stripIndexRef.current - 1); }}
                onPointerDown={e => e.stopPropagation()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm"
                onClick={e => { e.stopPropagation(); navigate(stripIndexRef.current + 1); }}
                onPointerDown={e => e.stopPropagation()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}
        </div>
      {n > 1 && (
        <div className="flex justify-center gap-1 mt-1">
          {validUrls.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIndex ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>

      {lightboxOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={validUrls[imgIndex]}
            alt={alt}
            className="max-h-screen max-w-screen w-auto h-auto rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          {n > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
                onClick={e => { e.stopPropagation(); navigate(stripIndexRef.current - 1); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
                onClick={e => { e.stopPropagation(); navigate(stripIndexRef.current + 1); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
