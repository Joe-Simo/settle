export const maxDuration = 60;
export const preferredRegion = "sfo1";

import { extractDeal } from "@/lib/extract";
import { limited, tooMany } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (limited(req, "extract", 6, 10 * 60_000)) return tooMany();
  const body = (await req.json().catch(() => null)) as { memo?: unknown } | null;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  if (memo.length < 20) return Response.json({ error: "Paste a deal memo or offer email first." }, { status: 400 });
  if (memo.length > 6000) return Response.json({ error: "Keep the memo under 6,000 characters." }, { status: 400 });
  return Response.json(await extractDeal(memo));
}
