"use client";

import { useState } from "react";

type Props = {
  onRefresh: () => Promise<void>;
};

export function RefreshButton({ onRefresh }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      await onRefresh();
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label =
    state === "loading" ? "Refreshing..." :
    state === "done" ? "Updated" :
    state === "error" ? "Failed" :
    null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      className={`pointer-events-auto flex h-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 disabled:opacity-60 ${
        state === "done"
          ? "bg-green-500/70 text-white"
          : state === "error"
            ? "bg-red-500/70 text-white"
            : "bg-[#07111f]/65 text-white/70"
      } ${label ? "gap-1.5 px-3" : "w-10"}`}
      aria-label="Refresh lift and slope status"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-4 w-4 shrink-0 ${state === "loading" ? "animate-spin" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.31H11.77a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.535a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.63 8.395a.75.75 0 0 0 1.449.39Z"
          clipRule="evenodd"
        />
      </svg>
      {label && <span className="text-[10px] font-medium tracking-wide">{label}</span>}
    </button>
  );
}
