/**
 * LLM Client — Central wrapper for Vercel AI SDK calls.
 *
 * Provides `callLlmStructured<T>()` — a single entry point for all
 * LLM interactions with:
 * - Configurable retry logic (maxRetries)
 * - Timeout control via AbortSignal
 * - Structured logging (model, tokens, latency)
 * - Graceful fallback on *any* failure (never throws)
 *
 * PATTERNS APPLIED (llm-app-patterns skill):
 * - Retry with exponential backoff (§5.2) — via SDK internals
 * - Fallback strategy (§5.3) — graceful degradation
 * - Structured logging (§4.2) — token + latency tracking
 *
 * NOTE: Router api.ourzhishi.top permanently removed 2026-03-29.
 * All calls go directly to official OpenAI API.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ── Configuration ───────────────────────────────────────────────────

/** Default model for all LLM calls. */
const DEFAULT_MODEL = "gpt-5.4-mini";

/** Timeout presets: sync (user-facing) vs async (background). */
export const LLM_TIMEOUTS = {
  /** User is waiting for chat response — keep fast. */
  sync: 15_000,
  /** Background analysis — can take longer. */
  async: 30_000,
} as const;

/** Retry presets: sync vs async. */
export const LLM_RETRIES = {
  /** Sync path: 1 retry (fast fail for UX). */
  sync: 1,
  /** Async path: 2 retries (more tolerant). */
  async: 2,
} as const;

// ── Types ───────────────────────────────────────────────────────────

/**
 * Constraint for schemas accepted by callLlmStructured.
 * Uses z.ZodObject to match generateObject's internal type requirements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZodObject = z.ZodObject<any, any, any>;

/** Options for a structured LLM call. */
export interface LlmCallOptions<T extends AnyZodObject> {
  /** Zod schema defining the expected output structure. */
  readonly schema: T;
  /** Human-readable name for the schema (improves OpenAI output). */
  readonly schemaName: string;
  /** System prompt defining the AI's role and constraints. */
  readonly systemPrompt: string;
  /** User message containing the data to analyze. Required if messages array is omitted. */
  readonly userMessage?: string;
  /** Array of multi-modal messages. If provided, overrides userMessage. */
  readonly messages?: any[];
  /** Timeout in milliseconds. Use LLM_TIMEOUTS presets. */
  readonly timeoutMs: number;
  /** Maximum number of retries. Use LLM_RETRIES presets. */
  readonly maxRetries: number;
  /** Fallback value returned if LLM call fails entirely. */
  readonly fallback: z.infer<T>;
  /** Optional model override. */
  readonly model?: string;
  /** Optional temperature override (defaults to 0.7). */
  readonly temperature?: number;
  /** Optional max output tokens override. */
  readonly maxOutputTokens?: number;
}

/** Result of a structured LLM call with metadata. */
export interface LlmCallResult<T> {
  /** The parsed, typed output object. */
  readonly data: T;
  /** Whether the result came from the LLM or the fallback. */
  readonly source: "llm" | "fallback";
  /** Token usage (null if fallback was used). */
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  } | null;
  /** Latency in milliseconds. */
  readonly latencyMs: number;
  /** Error message if fallback was used (null on success). */
  readonly errorMessage: string | null;
}

// ── Core Function ───────────────────────────────────────────────────

/**
 * Calls an LLM with structured output validation via Zod.
 * Uses official OpenAI API directly (no external router).
 */
export async function callLlmStructured<T extends AnyZodObject>(
  options: LlmCallOptions<T>,
): Promise<LlmCallResult<z.infer<T>>> {
  const startTime = Date.now();
  const model = options.model ?? DEFAULT_MODEL;

  try {
    // @ts-ignore - maxOutputTokens is supported in AI SDK 6.x but types might be outdated
    const result = await generateObject({
      model: openai(model),
      output: "object" as const,
      schema: options.schema,
      schemaName: options.schemaName,
      system: options.systemPrompt,
      ...(options.messages ? { messages: options.messages as any } : { prompt: options.userMessage as string }),
      maxRetries: options.maxRetries,
      abortSignal: AbortSignal.timeout(options.timeoutMs),
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens,
    });

    return finalizeResult(result, startTime, options.schemaName, model);
  } catch (error: unknown) {
    return handleFinalFailure(error, startTime, options.schemaName, model, options.fallback);
  }
}

/** Formats the successful LLM result. */
function finalizeResult(result: any, startTime: number, schemaName: string, model: string) {
  const latencyMs = Date.now() - startTime;
  const totalTokens = (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

  console.log(
    `[LLM] ✅ ${schemaName} | provider=openai | model=${model} | ` +
    `tokens=${totalTokens} | latency=${latencyMs}ms`,
  );

  return {
    data: result.object,
    source: "llm" as const,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens,
    },
    latencyMs,
    errorMessage: null,
  };
}

/** Formats the fallback result after failure. */
function handleFinalFailure(error: any, startTime: number, schemaName: string, model: string, fallback: any) {
  const latencyMs = Date.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  console.error(
    `[LLM] ❌ ${schemaName} | model=${model} | ` +
    `error="${errorMessage}" | latency=${latencyMs}ms | ` +
    `returning fallback`,
  );

  return {
    data: fallback,
    source: "fallback" as const,
    usage: null,
    latencyMs,
    errorMessage: errorMessage,
  };
}
