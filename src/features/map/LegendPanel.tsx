export function LegendPanel({ open }: { open: boolean }) {
  return (
    <div className={`select-none absolute right-0 top-full z-20 mt-2 w-[220px] rounded-[18px] border border-white/[0.09] bg-[#07111f]/85 p-4 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      {/* Slopes */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Slopes</p>
      {([
        { color: "#0069ea", letter: "B", label: "Easy" },
        { color: "#ff0000", letter: "R", label: "Medium" },
        { color: "#444444", letter: "S", label: "Difficult" },
      ] as const).map(({ color, letter, label }) => (
        <div key={label} className="flex items-center gap-2.5 py-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: color }}>{letter}</span>
          <span className="text-[12px] text-ivory">{label}</span>
        </div>
      ))}

      <div className="my-3 h-px bg-white/[0.07]" />

      {/* Lifts */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Lifts</p>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-5" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <rect x="-3" y="-11" width="6" height="3" rx="1" fill="white" />
            <line x1="-1.5" y1="-8" x2="-5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1.5" y1="-8" x2="5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="-8" y="-3" width="16" height="3" stroke="white" strokeWidth="1.5" />
            <rect x="-8" y="0" width="16" height="12" rx="2" stroke="white" strokeWidth="1.5" />
            <rect x="-7" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
            <rect x="2" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Gondola</span>
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-8" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="-10" r="3" fill="white" />
            <line x1="0" y1="-7" x2="0" y2="0" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <rect x="-10" y="0" width="20" height="11" rx="2" stroke="white" strokeWidth="1.5" />
            <line x1="1" y1="11" x2="6" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Chairlift</span>
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-8" x2="13" y2="-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="-11" r="2.5" fill="white" />
            <line x1="0" y1="-8.5" x2="0" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="-6" y1="9" x2="6" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Drag Lift</span>
      </div>

      <div className="my-3 h-px bg-white/[0.07]" />

      {/* Food */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Food &amp; Drink</p>
      {([
        { color: "#e8a020", label: "Mountain Restaurant" },
        { color: "#9b4dca", label: "Bar / Après-ski" },
        { color: "#20a090", label: "Café" },
      ] as const).map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2.5 py-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            <svg width="10" height="10" viewBox="-8 -8 16 16" fill="none" aria-hidden="true">
              <line x1="-3.5" y1="-7" x2="-3.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="-2" y1="-7" x2="-2" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="-0.5" y1="-7" x2="-0.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M-3.5,-3 Q-2,-1.5 -0.5,-3" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <line x1="-2" y1="-1.5" x2="-2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M2,-7 L3,-4 L2,-2.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="-2.5" x2="2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[12px] text-ivory">{label}</span>
        </div>
      ))}
    </div>
  );
}
