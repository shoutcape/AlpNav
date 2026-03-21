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
  const label = LIFT_TYPE_LABEL[lift.liftType];
  if (lift.altitudeValley != null && lift.altitudeMountain != null) {
    return `${label} · ${lift.altitudeValley} → ${lift.altitudeMountain} m`;
  }
  return label;
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
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a3320]">
      {liftType === "gondola" && (
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
          <line x1="1" y1="3" x2="15" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
          <line x1="8" y1="1" x2="8" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="3" y="3" width="10" height="8" rx="1.5" stroke="white" strokeWidth="1.5" />
        </svg>
      )}
      {liftType === "chairlift" && (
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
          <line x1="1" y1="3" x2="15" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
          <line x1="8" y1="1" x2="8" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 7 H11 V10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {(liftType === "drag" || liftType === "other") && (
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
          <line x1="1" y1="3" x2="15" y2="3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
          <line x1="8" y1="1" x2="8" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="11" x2="11" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
