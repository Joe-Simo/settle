import { llmEnabled, llmResting, LLM_MODELS } from "@/lib/llm";
import { paypalMode, publicClientId } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    paypal: paypalMode(),
    clientId: publicClientId(),
    ai: llmEnabled() ? (llmResting() ? "resting" : "live") : "off",
    model: llmEnabled() ? LLM_MODELS[0] : null,
  });
}
