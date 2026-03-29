import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { Piste, Lift, GastronomySpot, GastronomyType, PisteDifficulty, LiftType, Webcam, WebcamProvider, InfrastructurePoi, InfrastructureCategory, SportFunPoi, SportFunCategory } from "@/lib/domain/types";
import { ImageCarousel } from "./ImageCarousel";

type Props = {
  selectedItem: Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi | null;
  onDismiss: () => void;
};

const INFRA_CATEGORY_LABEL: Record<InfrastructureCategory, string> = {
  parking: "Parking",
  bus:     "Ski Bus Stop",
  info:    "Tourist Information",
  rescue:  "Slope Rescue",
};
const INFRA_CATEGORY_COLOR: Record<InfrastructureCategory, string> = {
  parking: "#2563eb",
  bus:     "#16a34a",
  info:    "#d97706",
  rescue:  "#dc2626",
};

const SPORT_FUN_LABEL: Record<SportFunCategory, string> = {
  skimovie: "SkiMovie",
  speedcheck: "Speed Check",
  skidepot: "Ski Depot",
  photopoint: "Photo Point",
  viewpoint: "Viewpoint",
};

const SPORT_FUN_COLOR: Record<SportFunCategory, string> = {
  skimovie: "#7c3aed",
  speedcheck: "#0284c7",
  skidepot: "#d97706",
  photopoint: "#db2777",
  viewpoint: "#16a34a",
};

const WEBCAM_PROVIDER_LABEL: Record<WebcamProvider, string> = {
  feratel: "Webcam (Feratel)",
  panomax: "Webcam (Panomax)",
};

const GASTRONOMY_TYPE_LABEL: Record<GastronomyType, string> = {
  restaurant: "Mountain Restaurant",
  bar:        "Bar / Après-ski",
  cafe:       "Café",
};
const GASTRONOMY_TYPE_COLOR: Record<GastronomyType, string> = {
  restaurant: "#e8a020",
  bar:        "#9b4dca",
  cafe:       "#20a090",
};

const DIFFICULTY_COLOR: Record<PisteDifficulty, string> = {
  easy:      "#0069ea",
  medium:    "#ff0000",
  difficult: "#444444",
  unknown:   "#9e9e9e",
};

const DIFFICULTY_LABEL: Record<PisteDifficulty, string> = {
  easy:      "Easy",
  medium:    "Medium",
  difficult: "Difficult",
  unknown:   "Unknown",
};

const LIFT_TYPE_LABEL: Record<LiftType, string> = {
  gondola:   "Gondola",
  chairlift: "Chairlift",
  drag:      "Drag Lift",
  other:     "Lift",
};

export function InfoSheet({ selectedItem, onDismiss }: Props) {
  const [liveMode, setLiveMode] = useState(false);

  // lastItem: the most recently shown non-null item; kept alive so content stays rendered during exit animation
  const [lastItem, setLastItem] = useState(selectedItem);
  const isDragDismissing = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Derived synchronously — no extra render cycle on open or close
  const displayedItem = selectedItem ?? lastItem;
  // Stays true until lastItem is cleared (after the close animation completes)
  const isVisible = selectedItem !== null || lastItem !== null;

  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);
  const prevItemRef = useRef(displayedItem);

  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const sheetHeightAtDragStart = useRef(0);
  const isDragging = useRef(false);
  const axisLocked = useRef<"h" | "v" | null>(null);

  // Keep lastItem in sync; manually animate wrapper on dismiss so we control easing and height is irrelevant
  useEffect(() => {
    if (selectedItem !== null) {
      clearTimeout(exitTimer.current);
      // Cancel any in-progress dismiss animation
      const el = wrapperRef.current;
      if (el) { el.style.transition = ""; el.style.transform = ""; }
      isDragDismissing.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastItem(selectedItem);
    } else {
      if (!isDragDismissing.current) {
        // Programmatic dismiss — animate manually (same as drag path) so easing is controlled
        const el = wrapperRef.current;
        if (el) {
          el.style.transition = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
          el.style.transform = "translateY(100%)";
          const onEnd = (ev: TransitionEvent) => {
            if (ev.propertyName !== "transform") return;
            el.removeEventListener("transitionend", onEnd);
            clearTimeout(exitTimer.current);
            el.style.transition = "";
            // Keep transform until Tailwind class takes over (isVisible → false after setLastItem(null))
            setLastItem(null);
          };
          el.addEventListener("transitionend", onEnd);
          // Fallback in case transitionend doesn't fire
          exitTimer.current = setTimeout(() => {
            el.removeEventListener("transitionend", onEnd);
            el.style.transition = "";
            el.style.transform = "";
            setLastItem(null);
          }, 400);
        } else {
          setLastItem(null);
        }
      } else {
        // Drag already animated out — just clear content
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastItem(null);
        isDragDismissing.current = false;
      }
    }
    return () => clearTimeout(exitTimer.current);
  }, [selectedItem]);

  function snapBack(el: HTMLDivElement) {
    el.style.transition = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "translateY(0)";
    const onEnd = (ev: TransitionEvent) => {
      if (ev.propertyName !== "transform") return;
      el.removeEventListener("transitionend", onEnd);
      el.style.transition = "";
      el.style.transform = "";
    };
    el.addEventListener("transitionend", onEnd);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    sheetHeightAtDragStart.current = wrapperRef.current?.offsetHeight || window.innerHeight * 0.5;
    isDragging.current = true;
    axisLocked.current = null;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (axisLocked.current === "v") {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }
    }

    if (axisLocked.current === "v") {
      const moveY = Math.max(0, dy);
      const el = wrapperRef.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${moveY}px)`;
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (axisLocked.current === "v") {
      const dy = Math.max(0, e.clientY - dragStartY.current);
      const velocity = dy / (Date.now() - dragStartTime.current);
      const el = wrapperRef.current;
      if (!el) return;

      const shouldDismiss = velocity > 0.4 || dy >= sheetHeightAtDragStart.current * 0.25;

      if (shouldDismiss) {
        isDragDismissing.current = true;
        el.style.transition = "transform 0.25s ease-out";
        el.style.transform = "translateY(100%)";
        const onEnd = (ev: TransitionEvent) => {
          if (ev.propertyName !== "transform") return;
          el.removeEventListener("transitionend", onEnd);
          el.style.transition = "";
          el.style.transform = "";
          onDismiss();
        };
        el.addEventListener("transitionend", onEnd);
      } else {
        snapBack(el);
      }
    }
  }

  function handlePointerCancel() {
    isDragging.current = false;
    if (axisLocked.current === "v") {
      const el = wrapperRef.current;
      if (el) snapBack(el);
    }
    axisLocked.current = null;
  }

  // Animate height when displayed content changes
  useLayoutEffect(() => {
    const card = cardRef.current;
    const prevItem = prevItemRef.current;
    prevItemRef.current = displayedItem;

    if (!card) return;

    const newHeight = card.offsetHeight;

    if (prevItem && displayedItem) {
      // Animate card height from old to new
      if (Math.abs(newHeight - prevHeightRef.current) > 1) {
        card.animate(
          [{ height: `${prevHeightRef.current}px` }, { height: `${newHeight}px` }],
          { duration: 280, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );
      }
    }

    prevHeightRef.current = newHeight;
  }, [displayedItem]);

  // Reset UI state on item change
  useEffect(() => {
    if (selectedItem) {
      setLiveMode(false);
    }
  }, [selectedItem]);

  return (
    <>
    <div
      ref={wrapperRef}
      className={`absolute inset-x-0 bottom-0 z-20 will-change-transform transition-transform duration-300 ease-out ${isVisible ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"}`}
    >
      <div 
        ref={cardRef} 
        className="rounded-t-[20px] border-t border-white/[0.09] bg-[#07111f]/85 px-5 pb-8 pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Drag handle */}
        <div className="flex mb-3 w-full justify-center -my-8 pt-6 touch-none">
          <div className="h-[3px] w-10 rounded-full bg-white/20" />
        </div>

        {displayedItem && (
          <div>
            <div className="flex items-center gap-3">
              {/* Icon / badge */}
              {"streamUrl" in displayedItem ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#1565c0]">
                  <WebcamIcon />
                </span>
              ) : "category" in displayedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-bold text-white"
                  style={{ backgroundColor: INFRA_CATEGORY_COLOR[displayedItem.category] }}
                >
                  {displayedItem.category === "parking" ? "P"
                    : displayedItem.category === "bus" ? "B"
                    : displayedItem.category === "rescue" ? <RescueIcon />
                    : "i"}
                </span>
              ) : "sportCategory" in displayedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center"
                  style={{
                    clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                    backgroundColor: SPORT_FUN_COLOR[displayedItem.sportCategory],
                  }}
                >
                  <SportFunCategoryIcon category={displayedItem.sportCategory} />
                </span>
              ) : "position" in displayedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: GASTRONOMY_TYPE_COLOR[displayedItem.type] }}
                >
                  <GastronomyIcon />
                </span>
              ) : "difficulty" in displayedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: DIFFICULTY_COLOR[displayedItem.difficulty] }}
                >
                  {displayedItem.difficulty === "easy" ? "B" : displayedItem.difficulty === "medium" ? "R" : "S"}
                </span>
              ) : (
                <LiftTypeIcon liftType={displayedItem.liftType} />
              )}

              {/* Name + type label */}
              <div className="min-w-0 flex-1">
                {"streamUrl" in displayedItem ? (
                  <>
                    <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                      {displayedItem.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {WEBCAM_PROVIDER_LABEL[displayedItem.provider]}
                    </p>
                  </>
                ) : "category" in displayedItem ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                        {displayedItem.name}
                      </p>
                      <StatusPill status={displayedItem.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {INFRA_CATEGORY_LABEL[displayedItem.category]}
                    </p>
                  </>
                ) : "sportCategory" in displayedItem ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                        {displayedItem.name}
                      </p>
                      <StatusPill status={displayedItem.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {SPORT_FUN_LABEL[displayedItem.sportCategory]}
                    </p>
                  </>
                ) : "position" in displayedItem ? (
                  <>
                    <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                      {displayedItem.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {GASTRONOMY_TYPE_LABEL[displayedItem.type]}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                        {displayedItem.name}
                        {"number" in displayedItem && displayedItem.number != null && (
                          <span className="ml-1.5 text-[13px] font-normal text-ivory/40">#{displayedItem.number}</span>
                        )}
                      </p>
                      <StatusPill status={displayedItem.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {"difficulty" in displayedItem
                        ? pisteSubtitle(displayedItem)
                        : liftSubtitle(displayedItem)}
                    </p>
                  </>
                )}
              </div>
            </div>

            {"liftType" in displayedItem && (displayedItem.imageUrls || displayedItem.description || displayedItem.openingHours) && (
              <div className="mt-3 flex flex-col gap-3">
                {(displayedItem.openingHours || displayedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {displayedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {displayedItem.openingHours}
                      </p>
                    )}
                    {displayedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {displayedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {displayedItem.imageUrls && displayedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={displayedItem.imageUrls}
                    alt={displayedItem.name}
                  />
                )}
              </div>
            )}

            {"streamUrl" in displayedItem && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="relative w-full max-w-[400px] sm:max-w-[800px] aspect-video overflow-hidden rounded-xl bg-black">
                  {liveMode ? (
                    <iframe
                      src={displayedItem.streamUrl}
                      className="w-full h-full border-0"
                      allow="autoplay"
                      title={displayedItem.name}
                    />
                  ) : (
                    <>
                      {displayedItem.thumbnailUrl && (
                        <img
                          src={displayedItem.thumbnailUrl}
                          alt={displayedItem.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => setLiveMode(true)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-[2px]"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="white" aria-hidden="true">
                            <path d="M6 4l12 6-12 6V4z" />
                          </svg>
                        </span>
                        <span className="text-[12px] font-medium text-white/90">Watch Live</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {"category" in displayedItem && (displayedItem.imageUrls?.length || displayedItem.openingHours || displayedItem.description) && (
              <div className="mt-3 flex flex-col gap-3">
                {(displayedItem.openingHours || displayedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {displayedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {displayedItem.openingHours}
                      </p>
                    )}
                    {displayedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {displayedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {displayedItem.imageUrls && displayedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={displayedItem.imageUrls}
                    alt={displayedItem.name}
                  />
                )}
              </div>
            )}

            {"sportCategory" in displayedItem && (displayedItem.imageUrls?.length || displayedItem.description) && (
              <div className="mt-3 flex flex-col gap-3">
                {displayedItem.description && (
                  <p className="line-clamp-3 text-[12px] text-ivory/50">
                    {displayedItem.description}
                  </p>
                )}
                {displayedItem.imageUrls && displayedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={displayedItem.imageUrls}
                    alt={displayedItem.name}
                  />
                )}
              </div>
            )}

            {"position" in displayedItem && !("streamUrl" in displayedItem) && !("category" in displayedItem) && !("sportCategory" in displayedItem) && ((displayedItem.imageUrls && displayedItem.imageUrls.length > 0) || displayedItem.openingHours || displayedItem.description || displayedItem.website) && (
              <div className="mt-3 flex flex-col gap-3">
                {(displayedItem.openingHours || displayedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {displayedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {displayedItem.openingHours}
                      </p>
                    )}
                    {displayedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {displayedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {displayedItem.website && (
                  <a
                    href={displayedItem.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-[10px] bg-white/[0.06] px-3 py-2.5 text-[13px] text-ivory/80 transition-colors hover:bg-white/[0.09] active:bg-white/[0.12]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span className="truncate">{displayedItem.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  </a>
                )}
                {displayedItem.imageUrls && displayedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={displayedItem.imageUrls}
                    alt={displayedItem.name}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function pisteSubtitle(piste: Piste): string {
  const label = DIFFICULTY_LABEL[piste.difficulty];
  if (piste.lengthM != null) {
    return `${label} · ${(piste.lengthM / 1000).toFixed(1)} km`;
  }
  return label;
}

function liftSubtitle(lift: Lift): string {
  const typeLabel = lift.subtitle ?? LIFT_TYPE_LABEL[lift.liftType];
  const parts: string[] = [typeLabel];
  if (lift.capacity != null) parts.push(`${lift.capacity} p/h`);
  if (lift.altitudeValley != null && lift.altitudeMountain != null) {
    const diff = lift.altitudeMountain - lift.altitudeValley;
    parts.push(`${lift.altitudeValley} → ${lift.altitudeMountain} m (+${diff} m)`);
  }
  return parts.join(" · ");
}

function StatusPill({ status }: { status?: "open" | "closed" }) {
  if (!status) return null;
  return status === "open" ? (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#1a3b1e] text-[#4caf50]">
      Open
    </span>
  ) : (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#3b1a1a] text-[#ef5350]">
      Closed
    </span>
  );
}

function WebcamIcon() {
  return (
    <svg width="16" height="16" viewBox="-9 -9 18 18" fill="none" aria-hidden="true">
      <rect x="-8" y="-5" width="16" height="10" rx="2" stroke="white" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="3" stroke="white" strokeWidth="1.5" />
      <rect x="-3" y="-8" width="5" height="3" rx="1" fill="white" />
    </svg>
  );
}

function RescueIcon() {
  return (
    <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
      <rect x="-2" y="-6" width="4" height="12" fill="white" />
      <rect x="-6" y="-2" width="12" height="4" fill="white" />
    </svg>
  );
}

function GastronomyIcon() {
  return (
    <svg width="16" height="16" viewBox="-8 -8 16 16" fill="none" aria-hidden="true">
      {/* Fork tines */}
      <line x1="-3.5" y1="-7" x2="-3.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="-2" y1="-7" x2="-2" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="-0.5" y1="-7" x2="-0.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      {/* Fork arch */}
      <path d="M-3.5,-3 Q-2,-1 -0.5,-3" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Fork handle */}
      <line x1="-2" y1="-1.5" x2="-2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      {/* Knife blade */}
      <path d="M2,-7 L3.5,-3.5 L2,-2" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Knife handle */}
      <line x1="2" y1="-2" x2="2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SportFunCategoryIcon({ category }: { category: SportFunCategory }) {
  switch (category) {
    case "skimovie":
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" fill="white" aria-hidden="true">
          <polygon points="-3,-5 6,0 -3,5" />
        </svg>
      );
    case "speedcheck":
      return (
        <svg width="12" height="12" viewBox="-6 -8 12 16" fill="none" aria-hidden="true">
          <polyline points="3,-7 -2,-1 3,-1 -3,7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "skidepot":
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" fill="none" aria-hidden="true">
          <line x1="-4" y1="-5" x2="4" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="-5" x2="-4" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "photopoint":
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" fill="none" aria-hidden="true">
          <rect x="-5" y="-2" width="10" height="6" rx="1.5" stroke="white" strokeWidth="1.3" />
          <circle cx="0" cy="1" r="2" stroke="white" strokeWidth="1.3" />
          <rect x="-3" y="-5" width="3" height="2.5" rx="0.8" fill="white" />
        </svg>
      );
    case "viewpoint":
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" fill="none" aria-hidden="true">
          <polygon points="-5,5 0,-5 5,5" fill="white" opacity="0.5" />
          <polygon points="-2,5 3,-4 8,5" fill="white" />
        </svg>
      );
  }
}

function LiftTypeIcon({ liftType }: { liftType: LiftType }) {
  // viewBox="-24 -24 48 48" — origin matches the Pixi map badge centre (cx=0, cy=0)
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
      {liftType === "gondola" && (
        <svg width="28" height="28" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
          {/* Angled cable */}
          <line x1="-13" y1="-5" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Grip clamp */}
          <rect x="-3" y="-11" width="6" height="3" rx="1" fill="white" />
          {/* V hangers */}
          <line x1="-1.5" y1="-8" x2="-5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="1.5" y1="-8" x2="5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          {/* Top deck */}
          <rect x="-8" y="-3" width="16" height="3" fill="#2c2c50" stroke="white" strokeWidth="1.5" />
          {/* Cabin */}
          <rect x="-8" y="0" width="16" height="12" rx="2" fill="#2c2c50" stroke="white" strokeWidth="1.5" />
          {/* Left window */}
          <rect x="-7" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" />
          {/* Right window */}
          <rect x="2" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" />
        </svg>
      )}
      {liftType === "chairlift" && (
        <svg width="28" height="28" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
          {/* Diagonal cable */}
          <line x1="-13" y1="-8" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Connection point */}
          <circle cx="0" cy="-10" r="3" fill="white" />
          {/* Short drop */}
          <line x1="0" y1="-7" x2="0" y2="-4" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* C-bracket */}
          <path d="M0,-4 L-4,-4 L-4,8 L0,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="miter" />
          {/* L-chair */}
          <path d="M0,0 L0,8 L7,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Footrest */}
          <line x1="1" y1="11" x2="6" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {(liftType === "drag" || liftType === "other") && (
        <svg width="28" height="28" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
          {/* Angled cable */}
          <line x1="-13" y1="-8" x2="13" y2="-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          {/* Clamp circle */}
          <circle cx="0" cy="-11" r="2.5" fill="white" />
          {/* Vertical pole */}
          <line x1="0" y1="-8.5" x2="0" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* T-bar */}
          <line x1="-6" y1="9" x2="6" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
