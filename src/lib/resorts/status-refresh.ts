export type StatusMap = Map<string, "open" | "closed">;

export type RefreshedStatus = {
  lifts: StatusMap;
  slopes: StatusMap;
};

export async function fetchFreshStatus(resortId: string): Promise<RefreshedStatus> {
  const res = await fetch(`/api/resorts/${resortId}/status`);
  if (!res.ok) throw new Error(`Status refresh failed: ${res.status}`);

  const data = await res.json();

  const lifts: StatusMap = new Map();
  for (const entry of data.lifts) {
    lifts.set(entry.id, entry.status);
  }

  const slopes: StatusMap = new Map();
  for (const entry of data.slopes) {
    slopes.set(entry.id, entry.status);
  }

  return { lifts, slopes };
}
