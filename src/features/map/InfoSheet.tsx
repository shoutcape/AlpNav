import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { Piste, Lift, GastronomySpot, GastronomyType, PisteDifficulty, LiftType, Webcam, WebcamProvider, InfrastructurePoi, InfrastructureCategory } from "@/lib/domain/types";
import { ImageCarousel } from "./ImageCarousel";

type Props = {
  selectedItem: Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | null;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [liveMode, setLiveMode] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);
  const prevItemRef = useRef(selectedItem);

  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const sheetHeightAtDragStart = useRef(0);
  const isDragging = useRef(false);

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
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartTime.current = Date.now();
    sheetHeightAtDragStart.current = wrapperRef.current?.offsetHeight || window.innerHeight * 0.5;
    isDragging.current = true;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    if (dy < 6) return; // dead-zone to avoid jitter on tap
    const el = wrapperRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!isDragging.current) return;
    isDragging.current = false;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    const velocity = dy / (Date.now() - dragStartTime.current);
    const el = wrapperRef.current;
    if (!el) return;

    const shouldDismiss = velocity > 0.4 || dy >= sheetHeightAtDragStart.current * 0.25;

    if (shouldDismiss) {
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

  function handlePointerCancel() {
    isDragging.current = false;
    const el = wrapperRef.current;
    if (el) snapBack(el);
  }

  // Animate height and fade content when switching between items
  useLayoutEffect(() => {
    const card = cardRef.current;
    const prevItem = prevItemRef.current;
    prevItemRef.current = selectedItem;

    if (!card) return;

    const newHeight = card.offsetHeight;

    if (prevItem && selectedItem) {
      // Animate card height from old to new
      if (Math.abs(newHeight - prevHeightRef.current) > 1) {
        card.animate(
          [{ height: `${prevHeightRef.current}px` }, { height: `${newHeight}px` }],
          { duration: 280, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );
      }
    }

    prevHeightRef.current = newHeight;
  }, [selectedItem]);

  // Prefetch images immediately on selection
  useEffect(() => {
    if (selectedItem && "imageUrls" in selectedItem && selectedItem.imageUrls) {
      selectedItem.imageUrls.forEach(url => { const img = new Image(); img.src = url; });
    }
  }, [selectedItem]);

  // Reset UI state on item change
  useEffect(() => {
    setLightboxOpen(false);
    setLightboxIndex(0);
    setLiveMode(false);
  }, [selectedItem]);

  const visible = selectedItem !== null;

  return (
    <>
    {lightboxOpen && selectedItem && (
      "liftType" in selectedItem ||
      "category" in selectedItem ||
      ("position" in selectedItem && !("streamUrl" in selectedItem) && !("category" in selectedItem))
    ) && selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setLightboxOpen(false)}
      >
        <img
          src={selectedItem.imageUrls[lightboxIndex]}
          alt={selectedItem.name}
          className="max-h-screen max-w-screen w-auto h-auto rounded-xl"
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}
    <div
      ref={wrapperRef}
      className={`absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 ease-out ${visible ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"}`}
    >
      <div ref={cardRef} className="rounded-t-[20px] border-t border-white/[0.09] bg-[#07111f]/85 px-5 pb-8 pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {/* Drag handle */}
        <div
          className="mx-auto flex mb-2 w-16 cursor-grab touch-none select-none items-center justify-center -my-2 py-2"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="h-[3px] w-10 rounded-full bg-white/20" />
        </div>

        {selectedItem && (
          <div>
            <div className="flex items-center gap-3">
              {/* Icon / badge */}
              {"streamUrl" in selectedItem ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#1565c0]">
                  <WebcamIcon />
                </span>
              ) : "category" in selectedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-bold text-white"
                  style={{ backgroundColor: INFRA_CATEGORY_COLOR[selectedItem.category] }}
                >
                  {selectedItem.category === "parking" ? "P"
                    : selectedItem.category === "bus" ? "B"
                    : selectedItem.category === "rescue" ? <RescueIcon />
                    : "i"}
                </span>
              ) : "position" in selectedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: GASTRONOMY_TYPE_COLOR[selectedItem.type] }}
                >
                  <GastronomyIcon />
                </span>
              ) : "difficulty" in selectedItem ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: DIFFICULTY_COLOR[selectedItem.difficulty] }}
                >
                  {selectedItem.difficulty === "easy" ? "B" : selectedItem.difficulty === "medium" ? "R" : "S"}
                </span>
              ) : (
                <LiftTypeIcon liftType={selectedItem.liftType} />
              )}

              {/* Name + type label */}
              <div className="min-w-0 flex-1">
                {"streamUrl" in selectedItem ? (
                  <>
                    <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                      {selectedItem.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {WEBCAM_PROVIDER_LABEL[selectedItem.provider]}
                    </p>
                  </>
                ) : "category" in selectedItem ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                        {selectedItem.name}
                      </p>
                      <StatusPill status={selectedItem.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {INFRA_CATEGORY_LABEL[selectedItem.category]}
                    </p>
                  </>
                ) : "position" in selectedItem ? (
                  <>
                    <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                      {selectedItem.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {GASTRONOMY_TYPE_LABEL[selectedItem.type]}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold leading-tight text-ivory">
                        {selectedItem.name}
                        {"number" in selectedItem && selectedItem.number != null && (
                          <span className="ml-1.5 text-[13px] font-normal text-ivory/40">#{selectedItem.number}</span>
                        )}
                      </p>
                      <StatusPill status={selectedItem.status} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-ivory/50">
                      {"difficulty" in selectedItem
                        ? pisteSubtitle(selectedItem)
                        : liftSubtitle(selectedItem)}
                    </p>
                  </>
                )}
              </div>
            </div>

            {"liftType" in selectedItem && (selectedItem.imageUrls || selectedItem.description || selectedItem.openingHours) && (
              <div className="mt-3 flex flex-col gap-3">
                {(selectedItem.openingHours || selectedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {selectedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {selectedItem.openingHours}
                      </p>
                    )}
                    {selectedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {selectedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={selectedItem.imageUrls}
                    alt={selectedItem.name}
                    onOpenLightbox={() => setLightboxOpen(true)}
                    onIndexChange={setLightboxIndex}
                  />
                )}
              </div>
            )}

            {"streamUrl" in selectedItem && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="relative mx-auto w-full max-w-[350px] aspect-[4/3] overflow-hidden rounded-xl bg-black">
                  {liveMode ? (
                    <iframe
                      src={selectedItem.streamUrl}
                      className="w-full h-full border-0"
                      allow="autoplay"
                      title={selectedItem.name}
                    />
                  ) : (
                    <>
                      {selectedItem.thumbnailUrl && (
                        <img
                          src={selectedItem.thumbnailUrl}
                          alt={selectedItem.name}
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

            {"category" in selectedItem && (selectedItem.imageUrls?.length || selectedItem.openingHours || selectedItem.description) && (
              <div className="mt-3 flex flex-col gap-3">
                {(selectedItem.openingHours || selectedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {selectedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {selectedItem.openingHours}
                      </p>
                    )}
                    {selectedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {selectedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={selectedItem.imageUrls}
                    alt={selectedItem.name}
                    onOpenLightbox={() => setLightboxOpen(true)}
                    onIndexChange={setLightboxIndex}
                  />
                )}
              </div>
            )}

            {"position" in selectedItem && !("streamUrl" in selectedItem) && !("category" in selectedItem) && ((selectedItem.imageUrls && selectedItem.imageUrls.length > 0) || selectedItem.openingHours || selectedItem.description) && (
              <div className="mt-3 flex flex-col gap-3">
                {(selectedItem.openingHours || selectedItem.description) && (
                  <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1.5">
                    {selectedItem.openingHours && (
                      <p className="text-[12px] text-ivory/60">
                        🕐 {selectedItem.openingHours}
                      </p>
                    )}
                    {selectedItem.description && (
                      <p className="line-clamp-3 text-[12px] text-ivory/50">
                        {selectedItem.description}
                      </p>
                    )}
                  </div>
                )}
                {selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                  <ImageCarousel
                    imageUrls={selectedItem.imageUrls}
                    alt={selectedItem.name}
                    onOpenLightbox={() => setLightboxOpen(true)}
                    onIndexChange={setLightboxIndex}
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
