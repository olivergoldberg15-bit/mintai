/**
 * OpenRouter client. The API key never leaves the server.
 *
 * Two things about the free tier drive this file:
 *
 * 1. Free model IDs churn constantly, so every request walks a fallback chain
 *    and returns the first model that answers. `openrouter/free` leads both
 *    chains — it is a meta-router that picks an available free model itself.
 *
 * 2. Most free models now are REASONING models. They spend their token budget
 *    thinking and return it in `message.reasoning`, leaving `message.content`
 *    null and `finish_reason: "length"`. So we ask for low-effort reasoning,
 *    give generous headroom, and fall back to the reasoning text if that is
 *    all we got. Chains and limits verified against the live API.
 */

const API = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Vercel caps a serverless function at 60s, and a killed function returns the
 * platform's error page rather than ours. Keep the entire fallback chain inside
 * that, leaving headroom for the response to be written.
 */
const TOTAL_BUDGET_MS = 50_000;
const PER_MODEL_MS = 24_000;
const MIN_ATTEMPT_MS = 6_000;

const DEFAULT_TEXT = [
  "openrouter/free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
  "nex-agi/nex-n2.5-pro:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

const DEFAULT_VISION = [
  "openrouter/free",
  "inclusionai/ling-3.0-flash-vl:free",
  "google/gemma-4-31b-it:free",
  "nex-agi/nex-n2.5-pro:free",
  "thinkingmachines/inkling:free",
  "dots-studio/dots-3-note-preview:free",
];

function chain(envVar: string, fallback: string[]): string[] {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image_url"; image_url: { url: string } };
export type Content = string | (TextPart | ImagePart)[];
export type Msg = { role: "system" | "user" | "assistant"; content: Content };

export class TutorError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** True when a failure is worth retrying on the next model in the chain. */
function retryable(status: number): boolean {
  // 429 rate limited, 402 free credits gone, 404 model retired, 403 provider
  // refused, 400 model rejected the payload (e.g. no image support), 5xx
  // upstream. A bad API key surfaces as 401, which retrying will not fix.
  return (
    status === 429 || status === 402 || status === 404 ||
    status === 403 || status === 400 || status >= 500
  );
}

type Choice = {
  message?: { content?: string | null; reasoning?: string | null };
  finish_reason?: string;
};

/**
 * Pull the usable answer out of a reply. Reasoning models sometimes put
 * everything in `reasoning`; rather than failing, salvage the tail of it.
 */
function extract(choice: Choice | undefined): string {
  const content = choice?.message?.content?.trim();
  if (content) return content;

  const reasoning = choice?.message?.reasoning?.trim();
  if (reasoning && choice?.finish_reason !== "length") {
    // Take the last paragraph — that is where such models land their answer.
    const parts = reasoning.split(/\n\s*\n/).filter((p) => p.trim());
    return (parts[parts.length - 1] ?? reasoning).trim();
  }

  return "";
}

async function callModel(
  model: string,
  messages: Msg[],
  opts: { maxTokens: number; temperature: number; json: boolean; signal?: AbortSignal },
): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution on the free tier.
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://mintai-three.vercel.app",
      "X-Title": "Tutor Mint",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      // Keep thinking short and out of the response; brevity is enforced by
      // the prompts, not by starving the model of tokens.
      reasoning: { effort: "low", exclude: true },
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TutorError(`${model}: ${res.status} ${body.slice(0, 180)}`, res.status);
  }

  const data = await res.json();

  // OpenRouter can return HTTP 200 with an error body when a provider fails.
  if (data?.error) {
    const status = Number(data.error.code) || 502;
    throw new TutorError(`${model}: ${data.error.message ?? "upstream error"}`, status);
  }

  const text = extract(data?.choices?.[0]);
  if (!text) {
    // Ran out of budget mid-thought, or returned nothing usable — next model.
    throw new TutorError(`${model}: no usable reply`, 502);
  }
  return text;
}

export async function complete(
  messages: Msg[],
  opts: {
    vision?: boolean;
    maxTokens?: number;
    temperature?: number;
    json?: boolean;
  } = {},
): Promise<{ text: string; model: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new TutorError("OPENROUTER_API_KEY is not set on the server.", 500);
  }

  const models = opts.vision
    ? chain("OPENROUTER_VISION_MODELS", DEFAULT_VISION)
    : chain("OPENROUTER_TEXT_MODELS", DEFAULT_TEXT);

  const settings = {
    maxTokens: opts.maxTokens ?? 1600,
    temperature: opts.temperature ?? 0.55,
    json: opts.json ?? false,
  };

  // The whole chain has to finish inside the serverless function's limit.
  // Overrun it and the platform kills the request and returns its own error
  // page, so the friendly JSON below never reaches the browser.
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let last: TutorError | null = null;

  for (const model of models) {
    const remaining = deadline - Date.now();
    // Not enough time left to be worth starting another attempt.
    if (remaining < MIN_ATTEMPT_MS) break;

    // Free models are slow when busy; cap each attempt so the chain keeps
    // moving, and never let one attempt eat the whole budget.
    const timer = AbortSignal.timeout(Math.min(PER_MODEL_MS, remaining));
    try {
      const text = await callModel(model, messages, { ...settings, signal: timer });
      return { text, model };
    } catch (err) {
      const e =
        err instanceof TutorError
          ? err
          : new TutorError(`${model}: ${(err as Error).message}`, 502);
      last = e;
      if (!retryable(e.status)) throw e;
      // else: try the next model in the chain
    }
  }

  throw new TutorError(
    `Every free model is busy right now. Give it a minute and try again. (${last?.message ?? "no models available"})`,
    503,
  );
}

/** Pull the first JSON object/array out of a model reply. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (!match) throw new TutorError("Could not read the model's reply.", 502);
    return JSON.parse(match[0]) as T;
  }
}
