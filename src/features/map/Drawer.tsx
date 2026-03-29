import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { ResortDefinition } from "@/lib/resorts/types";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  areas: ResortDefinition[];
  activeAreaId: string;
  currentArea: ResortDefinition;
  onSelectArea: (areaId: string) => void;
};

function getFocusableElements(panel: HTMLDivElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((element) => {
    if (element.matches(":disabled")) {
      return false;
    }

    const tabIndex = element.getAttribute("tabindex");
    return tabIndex !== "-1";
  });
}

export function Drawer({ open, onClose, areas, activeAreaId, currentArea, onSelectArea }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  // Capture the element that triggered open so we can restore focus on close
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement;
      // Focus the first focusable element inside the panel
      const first = getFocusableElements(panelRef.current)[0];
      first?.focus();
    } else {
      (returnFocusRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // Close on Escape; trap Tab/Shift+Tab inside the panel
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[39] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={false}
        animate={{ x: open ? 0 : -280 }}
        transition={
          open
            ? { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }
            : { type: "tween", duration: 0.2, ease: [0.32, 0.72, 0, 1] }
        }
        inert={!open || undefined}
        role="dialog"
        aria-label="Menu"
        aria-hidden={!open}
        onKeyDown={handleKeyDown}
        className="fixed left-0 top-0 z-40 h-full w-[280px] border-r border-white/[0.09] bg-[#07111f]/90 shadow-[4px_0_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-8 pb-3 min-h-[82px]">
          <span className="max-w-[200px] text-[15px] font-semibold tracking-tight text-ivory leading-tight">{currentArea.name}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.06] text-ivory/50 transition-colors hover:text-ivory active:scale-95"
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        {/* Resort meta */}
        <div className="px-4 pb-5">
          <p className="text-xs text-ivory/40">{currentArea.subtitle}</p>
          <p className="text-xs text-ivory/40">{currentArea.locationLabel}</p>
          <p className="text-xs text-ivory/40">{currentArea.elevationLabel}</p>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/[0.07]" />

        {/* Areas */}
        <div className="px-3 py-3 space-y-1" aria-label="Browse area">
          {areas.map((area) => {
            const isActive = area.id === activeAreaId;
            const isAvailable = area.availability === "available";

            return (
              <button
                key={area.id}
                type="button"
                disabled={!isAvailable}
                aria-pressed={isActive}
                onClick={() => onSelectArea(area.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3 min-h-[52px] py-2 text-left transition-colors ${
                  isActive
                    ? "bg-white/[0.11] text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    : isAvailable
                      ? "text-ivory/82 hover:bg-white/[0.05] active:bg-white/[0.08]"
                      : "cursor-not-allowed text-ivory/28"
                }`}
              >
                <p className="text-sm font-medium tracking-tight">{area.name}</p>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/[0.07]" />

        {/* External links */}
        <div className="mt-2 px-3">
          <a
            href={currentArea.conditionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-3 transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.06] text-ivory/60">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="1" x2="8" y2="15" />
                  <line x1="1" y1="8" x2="15" y2="8" />
                  <line x1="3" y1="3" x2="13" y2="13" />
                  <line x1="13" y1="3" x2="3" y2="13" />
                  <circle cx="8" cy="8" r="2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-ivory">Snow conditions</p>
                <p className="text-xs text-ivory/40">bergfex.com</p>
              </div>
            </div>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ivory/30 flex-shrink-0">
              <line x1="2" y1="10" x2="10" y2="2" />
              <polyline points="4,2 10,2 10,8" />
            </svg>
          </a>
        </div>

        {/* Divider */}
        <div className="mx-5 mt-3 h-px bg-white/[0.07]" />

        {/* About */}
        <div className="px-5 py-4">
          <p className="text-xs text-ivory/30 leading-relaxed">Alpine navigation for skiers. Explore runs, lifts, and mountain services.</p>
          <p className="mt-1 text-[10px] text-ivory/20">AlpNav v0.1.0</p>
        </div>
      </motion.div>
    </>
  );
}
