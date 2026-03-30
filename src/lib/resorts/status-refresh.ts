export type StatusMap = Map<string, "open" | "closed">;

export type RefreshedStatus = {
  lifts: StatusMap;
  slopes: StatusMap;
};

export function applyFreshStatus(
  lifts: { id: string; status?: string }[],
  pistes: { id: string; status?: string }[],
  fresh: RefreshedStatus,
) {
  for (const lift of lifts) {
    const s = fresh.lifts.get(lift.id);
    if (s) lift.status = s;
  }
  for (const piste of pistes) {
    const s = fresh.slopes.get(piste.id);
    if (s) piste.status = s;
  }
}

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
