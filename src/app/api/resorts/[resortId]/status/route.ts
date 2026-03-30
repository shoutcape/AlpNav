import { NextResponse } from "next/server";
import { INTERMAPS_CONFIG } from "@/lib/resorts/intermaps/intermaps-config";

type StatusEntry = { id: string; status: "open" | "closed" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resortId: string }> },
) {
  const { resortId } = await params;
  const config = INTERMAPS_CONFIG[resortId];

  if (!config) {
    return NextResponse.json({ error: "Unknown resort" }, { status: 404 });
  }

  const url = `https://zillertal.intermaps.com/${config.intermapsId}/data?lang=en`;

  const res = await fetch(url, {
    headers: {
      Referer: `https://zillertal.intermaps.com/${config.intermapsId}?lang=en`,
      "User-Agent": "Mozilla/5.0 (compatible; AlpNav status refresh)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 },
    );
  }

  const data = await res.json();

  const lifts: StatusEntry[] = (
    (data.lifts ?? []) as Array<Record<string, unknown>>
  )
    .filter((l) => l.id && (l.status === "open" || l.status === "closed"))
    .map((l) => ({ id: l.id as string, status: l.status as "open" | "closed" }));

  const slopes: StatusEntry[] = (
    (data.slopes ?? []) as Array<Record<string, unknown>>
  )
    .filter((s) => s.id && (s.status === "open" || s.status === "closed"))
    .map((s) => ({ id: s.id as string, status: s.status as "open" | "closed" }));

  return NextResponse.json({ lifts, slopes });
}
