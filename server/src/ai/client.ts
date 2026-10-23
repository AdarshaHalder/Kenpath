import OpenAI from "openai";
import { env } from "../config/env";
import { getDb } from "../db/connection";

/**
 * OpenAI wrapper with the production concerns every call needs: availability check, a circuit
 * breaker (stop calling for 60s after 3 consecutive failures, so officers never wait on
 * timeouts during an outage), and per-call usage logging for cost visibility.
 * The SDK retries 408/409/429/5xx twice with backoff.
 */

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (env.AI_DISABLED || !env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.AI_TIMEOUT_MS, maxRetries: 2 });
  return client;
}

/** Test hook. */
export function setOpenAI(c: OpenAI | null): void {
  client = c;
}

const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;
const breaker = { failures: 0, openUntil: 0 };

export const isAiAvailable = () => getOpenAI() !== null && Date.now() >= breaker.openUntil;

export function aiStatus() {
  return { configured: getOpenAI() !== null, model: env.AI_MODEL, circuitOpen: Date.now() < breaker.openUntil };
}

export function resetBreaker(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

interface CompletionLike {
  usage?: OpenAI.CompletionUsage;
  choices: Array<{ finish_reason: string; message: { refusal?: string | null } }>;
}

export async function trackedCall<T extends CompletionLike>(applicationId: string, fn: (c: OpenAI) => Promise<T>): Promise<T> {
  const openai = getOpenAI();
  if (!openai || !isAiAvailable()) throw new Error("AI is not available");
  const started = Date.now();
  try {
    const res = await fn(openai);
    const choice = res.choices[0];
    if (choice?.message.refusal) throw new Error("Model declined the request");
    if (choice?.finish_reason === "length") throw new Error("Model output was truncated");
    breaker.failures = 0;
    log(applicationId, true, Date.now() - started, res.usage ?? null, null);
    return res;
  } catch (err) {
    if (++breaker.failures >= BREAKER_THRESHOLD) breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    log(applicationId, false, Date.now() - started, null, describe(err));
    throw err;
  }
}

function describe(err: unknown): string {
  if (err instanceof OpenAI.RateLimitError) return "rate_limited";
  if (err instanceof OpenAI.AuthenticationError) return "authentication_failed";
  if (err instanceof OpenAI.APIConnectionTimeoutError) return "timeout";
  if (err instanceof OpenAI.APIConnectionError) return "connection_error";
  if (err instanceof OpenAI.APIError) return `api_error_${err.status ?? "unknown"}`;
  return err instanceof Error ? err.message.slice(0, 200) : "unknown_error";
}

function log(applicationId: string, success: boolean, latencyMs: number, usage: OpenAI.CompletionUsage | null, error: string | null) {
  try {
    getDb()
      .prepare(
        `INSERT INTO ai_usage (application_id, model, success, input_tokens, output_tokens, cached_tokens, latency_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(applicationId, env.AI_MODEL, success ? 1 : 0, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null,
        usage?.prompt_tokens_details?.cached_tokens ?? null, latencyMs, error);
  } catch (e) {
    console.warn("[ai] failed to log usage", e); // observability must never break the request
  }
}
