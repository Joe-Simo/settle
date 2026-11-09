/** Small per-instance rate limiter so the public demo cannot burn the free model quota or spam the sandbox. */
const buckets = new Map<string, { count: number; reset: number }>();

export function limited(req: Request, kind: string, max: number, windowMs: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > max;
}

export function tooMany() {
  return Response.json({ error: "Too many requests from this address. Try again in a few minutes." }, { status: 429 });
}
