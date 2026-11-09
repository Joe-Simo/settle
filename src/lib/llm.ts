import { createHash } from "node:crypto";

/**
 * One call to a free open model on OpenRouter that must return a JSON object. The free tier allows
 * a small number of requests a day for the whole account, so callers cache and always have a deterministic fallback.
 */
export const LLM_MODELS = (
  process.env.SETTLE_LLM_MODELS ??
  "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const llmEnabled = () => !!process.env.OPENROUTER_API_KEY?.trim();

let restingUntil = 0;
const nextUtcMidnight = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
};
export const llmResting = () => Date.now() < restingUntil;

/** Per instance daily cap so a public demo cannot drain the shared free quota. */
const DAILY_CAP = Number(process.env.SETTLE_LLM_CALLS_PER_DAY ?? 30);
let used = { day: "", count: 0 };
function takeCall(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (used.day !== day) used = { day, count: 0 };
  if (used.count >= DAILY_CAP) return false;
  used.count += 1;
  return true;
}

/** House style: no em or en dashes in anything a model writes. */
export function tidy(s: string): string {
  return s
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/[\u2010-\u2013]/g, "-")
    .replace(/\u00a0/g, " ");
}

const memo = new Map<string, { json: unknown; model: string }>();

export function cacheKey(kind: string, payload: string): string {
  return `${kind}:${createHash("sha256").update(payload).digest("hex").slice(0, 24)}`;
}

export async function chatJson(
  kind: string,
  system: string,
  user: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<{ json: unknown; model: string; cached: boolean }> {
  const key = cacheKey(kind, system + "\n" + user);
  const hit = memo.get(key);
  if (hit) return { ...hit, cached: true };
  if (!llmEnabled()) throw new Error("no model key");
  if (llmResting()) throw new Error("free daily model quota used up");
  if (!takeCall()) throw new Error("demo daily model cap reached");
  const send = () =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/Joe-Simo/settle",
      "X-Title": "Settle",
    },
    body: JSON.stringify({
      model: LLM_MODELS[0],
      models: LLM_MODELS.slice(0, 3),
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 4000,
      reasoning: { effort: "low" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
  });
  let res = await send();
  if ([502, 503, 504].includes(res.status)) res = await send();
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429 && /per-day|daily|free-models-per-day/i.test(text)) restingUntil = nextUtcMidnight();
    throw new Error(`OpenRouter ${res.status}`);
  }
  const data = JSON.parse(text) as { model?: string; error?: { message?: string }; choices?: { message?: { content?: string | null } }[] };
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message ?? "unknown"}`);
  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("model returned no JSON");
  const out = { json: JSON.parse(tidy(json)) as unknown, model: data.model ?? LLM_MODELS[0] };
  memo.set(key, out);
  return { ...out, cached: false };
}
