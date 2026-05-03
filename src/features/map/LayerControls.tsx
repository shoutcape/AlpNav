import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { PisteDifficulty } from "@/lib/domain/types";
import { DIFFICULTIES, DIFFICULTY_CSS_COLORS, DIFFICULTY_LABELS } from "./map-constants";
import { GastronomyMapIcon, InfrastructureMapIcon, LayersIcon, LiftIcon, SlopeIcon, SportFunMapIcon, WebcamMapIcon } from "./MapIcons";

type LayerControlsProps = {
  controlsExpanded: boolean;
  controlsDismissing: boolean;
  pisteVisible: boolean;
  pisteFilter: Record<PisteDifficulty, boolean>;
  filterPanelOpen: boolean;
  liftVisible: boolean;
  gastronomyVisible: boolean;
  webcamVisible: boolean;
  infrastructureVisible: boolean;
  sportFunVisible: boolean;
  onExpand: () => void;
  onDismissAnimationComplete: () => void;
  onToggleFilterPanel: () => void;
  onToggleLifts: () => void;
  onToggleDifficultyFilter: (difficulty: PisteDifficulty) => void;
  onToggleAllPistes: () => void;
  onToggleGastronomy: () => void;
  onToggleWebcam: () => void;
  onToggleInfrastructure: () => void;
  onToggleSportFun: () => void;
};

export function LayerControls({
  controlsExpanded,
  controlsDismissing,
  pisteVisible,
  pisteFilter,
  filterPanelOpen,
  liftVisible,
  gastronomyVisible,
  webcamVisible,
  infrastructureVisible,
  sportFunVisible,
  onExpand,
  onDismissAnimationComplete,
  onToggleFilterPanel,
  onToggleLifts,
  onToggleDifficultyFilter,
  onToggleAllPistes,
  onToggleGastronomy,
  onToggleWebcam,
  onToggleInfrastructure,
  onToggleSportFun,
}: LayerControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-8">
      <motion.div
        layout
        className={`pointer-events-auto rounded-[22px] border border-white/[0.09] bg-[#07111f]/68 p-1.5 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md${controlsExpanded && !controlsDismissing ? "" : " overflow-hidden"}`}
        transition={{ layout: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }}
        onLayoutAnimationComplete={onDismissAnimationComplete}
      >
        {!controlsExpanded ? (
          <button
            onClick={onExpand}
            aria-expanded={controlsExpanded}
            aria-label="Map layer controls"
            onContextMenu={e => e.preventDefault()}
            className={`touch-none select-none flex flex-col items-center gap-1 rounded-[14px] px-4 py-2 text-ivory/70 hover:bg-white/[0.07] hover:text-ivory transition-opacity duration-150${controlsDismissing ? " opacity-0" : " opacity-100"}`}
          >
            <LayersIcon />
            <DifficultyDots pisteVisible={pisteVisible} pisteFilter={pisteFilter} />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">Layers</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            <MapControlButton icon={<LiftIcon />} label="Lifts" active={liftVisible} onClick={onToggleLifts} />
            <div className="relative">
              <DifficultyFilterPanel filter={pisteFilter} open={filterPanelOpen} onToggle={onToggleDifficultyFilter} onToggleAll={onToggleAllPistes} />
              <button
                onClick={onToggleFilterPanel}
                onContextMenu={e => e.preventDefault()}
                className={`touch-none select-none flex w-full flex-col items-center gap-1 rounded-[16px] px-5 py-2.5 ${pisteVisible || filterPanelOpen ? "bg-white/[0.11] text-ivory" : "text-ivory/40 hover:bg-white/[0.07] hover:text-ivory/70"}`}
              >
                <SlopeIcon />
                <DifficultyDots pisteVisible={pisteVisible} pisteFilter={pisteFilter} />
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">Slopes</span>
              </button>
            </div>
            <MapControlButton icon={<GastronomyMapIcon />} label="Food" active={gastronomyVisible} onClick={onToggleGastronomy} />
            <MapControlButton icon={<WebcamMapIcon />} label="Webcams" active={webcamVisible} onClick={onToggleWebcam} />
            <MapControlButton icon={<InfrastructureMapIcon />} label="Info" active={infrastructureVisible} onClick={onToggleInfrastructure} />
            <MapControlButton icon={<SportFunMapIcon />} label="Sport" active={sportFunVisible} onClick={onToggleSportFun} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function DifficultyDots({ pisteVisible, pisteFilter }: { pisteVisible: boolean; pisteFilter: Record<string, boolean> }) {
  return (
    <div className="flex gap-[3px] items-center h-[5px]">
      {DIFFICULTIES.map(diff => (
        <span
          key={diff}
          className="w-[5px] h-[5px] rounded-full"
          style={{
            backgroundColor: DIFFICULTY_CSS_COLORS[diff],
            opacity: pisteVisible && pisteFilter[diff] ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

function MapControlButton({ icon, label, active, onClick, onPointerDown, onPointerUp, onPointerLeave }: {
  icon: ReactNode; label: string; active: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={e => e.preventDefault()}
      className={`touch-none select-none flex w-full flex-col items-center gap-1.5 rounded-[16px] px-5 py-2.5 ${active ? "bg-white/[0.11] text-ivory" : "text-ivory/40 hover:bg-white/[0.07] hover:text-ivory/70"}`}
    >
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">{label}</span>
    </button>
  );
}

function DifficultyFilterPanel({ filter, open, onToggle, onToggleAll }: {
  filter: Record<PisteDifficulty, boolean>;
  open: boolean;
  onToggle: (d: PisteDifficulty) => void;
  onToggleAll: () => void;
}) {
  const activeCount = DIFFICULTIES.filter(d => filter[d]).length;
  const allOpacity = activeCount === DIFFICULTIES.length ? "opacity-100" : "opacity-30";
  const allBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) allBtnRef.current?.focus();
  }, [open]);

  return (
    <div inert={!open || undefined} className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 rounded-[18px] border border-white/[0.09] bg-[#07111f]/68 p-1.5 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      <button
        ref={allBtnRef}
        onClick={onToggleAll}
        className={`flex flex-col items-center gap-1 rounded-[12px] px-3 py-2 transition-[transform,opacity] active:scale-[0.96] ${allOpacity}`}
      >
        <span className="w-4 h-4 rounded-full bg-white ring-1 ring-black" />
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ivory">All</span>
      </button>
      <div className="w-px self-stretch bg-white/[0.08] mx-0.5" />
      {DIFFICULTIES.map(diff => (
        <button
          key={diff}
          onClick={() => onToggle(diff)}
          className={`flex flex-col items-center gap-1 rounded-[12px] px-3 py-2 transition-[transform,opacity] active:scale-[0.96] ${filter[diff] ? "opacity-100" : "opacity-30"}`}
        >
          <span className="w-4 h-4 rounded-full ring-1 ring-black" style={{ backgroundColor: DIFFICULTY_CSS_COLORS[diff] }} />
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ivory">{DIFFICULTY_LABELS[diff]}</span>
        </button>
      ))}
    </div>
  );
}
