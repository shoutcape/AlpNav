import type { Piste, Lift, PisteDifficulty, LiftType } from "@/lib/domain/types";

type Props = {
  selectedItem: Piste | Lift | null;
};

const DIFFICULTY_COLOR: Record<PisteDifficulty, string> = {
  easy:      "#42a5f5",
  medium:    "#ef5350",
  difficult: "#78909c",
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
  const visible = selectedItem !== null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 transition-transform duration-300 ease-out ${visible ? "translate-y-0 pointer-events-auto" : "translate-y-full"}`}
    >
      <div className="rounded-t-[20px] border-t border-white/[0.09] bg-[#07111f]/85 px-5 pb-8 pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-[3px] w-10 rounded-full bg-white/20" />

        {selectedItem && (
          <div className="flex items-center gap-3">
            {/* Icon / badge */}
            {"difficulty" in selectedItem ? (
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
            </div>
          </div>
        )}
      </div>
    </div>
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
