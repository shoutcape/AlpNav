type MapLoadingBarProps = {
  loadedLevelCount: number;
  totalLevelCount: number;
};

type MapLoadErrorBannerProps = {
  loadError: string | null;
  activeAreaId: string;
};

export function MapLoadingBar({ loadedLevelCount, totalLevelCount }: MapLoadingBarProps) {
  const isLoading = loadedLevelCount < totalLevelCount;
  const progress = totalLevelCount > 0 ? (loadedLevelCount / totalLevelCount) * 100 : 0;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] transition-opacity duration-700"
      style={{ opacity: isLoading ? 1 : 0 }}
    >
      <div
        className="h-full bg-[#a8cfe0] transition-[width] duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function MapLoadErrorBanner({ loadError, activeAreaId }: MapLoadErrorBannerProps) {
  if (!loadError) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-16 z-30 rounded-[18px] border border-red-300/30 bg-red-950/85 px-4 py-3 text-sm text-red-50 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-200/80">Area load failed</p>
      {process.env.NODE_ENV !== "production" ? (
        <>
          <p className="mt-1 break-words text-red-50/95">{loadError}</p>
          <p className="mt-2 text-xs text-red-100/70">Active area: {activeAreaId}</p>
        </>
      ) : (
        <p className="mt-1 text-red-50/95">Unable to load this area. Please refresh and try again.</p>
      )}
    </div>
  );
}
