import { useState, useEffect } from "react";
import type { Piste, Lift, GastronomySpot, GastronomyType, PisteDifficulty, LiftType, Webcam, WebcamProvider } from "@/lib/domain/types";
import { ImageCarousel } from "./ImageCarousel";

type Props = {
  selectedItem: Piste | Lift | GastronomySpot | Webcam | null;
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

export function InfoSheet({ selectedItem }: Props) {
  const [displayedItem, setDisplayedItem] = useState(selectedItem);
  const [exiting, setExiting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [liveMode, setLiveMode] = useState(false);

  // Sequence transitions when switching between items
  useEffect(() => {
    if (selectedItem === null) {
      setExiting(false);
      setDisplayedItem(null);
      return;
    }
    if (displayedItem === null) {
      setDisplayedItem(selectedItem);
      return;
    }
    setExiting(true);
    const id = setTimeout(() => {
      setDisplayedItem(selectedItem);
      setExiting(false);
    }, 180);
    return () => clearTimeout(id);
  }, [selectedItem]);

  // Prefetch images immediately on selection (before exit animation finishes)
  useEffect(() => {
    if (selectedItem && "imageUrls" in selectedItem && selectedItem.imageUrls) {
      selectedItem.imageUrls.forEach(url => { const img = new Image(); img.src = url; });
    }
  }, [selectedItem]);

  // Reset UI state when new content is shown
  useEffect(() => {
    setLightboxOpen(false);
    setLightboxIndex(0);
    setLiveMode(false);
  }, [displayedItem]);

  const slideDown = exiting || displayedItem === null;
  const transitionDuration = exiting ? "duration-[180ms]" : "duration-300";

  return (
    <>
    {lightboxOpen && displayedItem && ("liftType" in displayedItem || ("position" in displayedItem && !("streamUrl" in displayedItem))) && displayedItem.imageUrls && displayedItem.imageUrls.length > 0 && (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setLightboxOpen(false)}
      >
        <img
          src={displayedItem.imageUrls[lightboxIndex]}
          alt={displayedItem.name}
          className="max-h-screen max-w-screen w-auto h-auto rounded-xl"
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}
    <div
      className={`absolute inset-x-0 bottom-0 z-20 transition-transform ease-out ${transitionDuration} ${slideDown ? "translate-y-full pointer-events-none" : "translate-y-0 pointer-events-auto"}`}
    >
      <div className="rounded-t-[20px] border-t border-white/[0.09] bg-[#07111f]/85 px-5 pb-8 pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-[3px] w-10 rounded-full bg-white/20" />

        {displayedItem && (
          <div>
            <div className="flex items-center gap-3">
              {/* Icon / badge */}
              {"streamUrl" in displayedItem ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#1565c0]">
                  <WebcamIcon />
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
                    onOpenLightbox={() => setLightboxOpen(true)}
                    onIndexChange={setLightboxIndex}
                  />
                )}
              </div>
            )}

            {"streamUrl" in displayedItem && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="relative mx-auto w-full max-w-[350px] aspect-[4/3] overflow-hidden rounded-xl bg-black">
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

            {"position" in displayedItem && !("streamUrl" in displayedItem) && ((displayedItem.imageUrls && displayedItem.imageUrls.length > 0) || displayedItem.openingHours || displayedItem.description) && (
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
