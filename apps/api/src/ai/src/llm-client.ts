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
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// ── Configuration ───────────────────────────────────────────────────

/** Default model for all LLM calls. */
const DEFAULT_MODEL = "gpt-4o";

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
  /** Optional model override (defaults to gpt-4o). */
  readonly model?: string;
  /** Optional temperature override (defaults to 0.7). */
  readonly temperature?: number;
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
 *
 * Uses Vercel AI SDK `generateObject()` which:
 * 1. Converts Zod schema → JSON Schema for OpenAI
 * 2. OpenAI returns structured JSON matching the schema
 * 3. SDK validates the response against Zod at runtime
 * 4. Returns a fully typed TypeScript object
 *
 * On *any* failure (timeout, rate limit, invalid response, network),
 * returns the provided `fallback` value instead of throwing.
 *
 * @param options - Full configuration for the call
 * @returns Typed result with metadata (source, usage, latency)
 */
export async function callLlmStructured<T extends AnyZodObject>(
  options: LlmCallOptions<T>,
): Promise<LlmCallResult<z.infer<T>>> {
  const startTime = Date.now();
  const modelId = options.model ?? DEFAULT_MODEL;

  try {
    const result = await generateObject({
      model: openai(modelId),
      output: "object" as const,
      schema: options.schema,
      schemaName: options.schemaName,
      system: options.systemPrompt,
      ...(options.messages ? { messages: options.messages as any } : { prompt: options.userMessage as string }),
      maxRetries: options.maxRetries,
      abortSignal: AbortSignal.timeout(options.timeoutMs),
      temperature: options.temperature ?? 0.7,
    });

    const latencyMs = Date.now() - startTime;
    const totalTokens =
      (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

    console.log(
      `[LLM] ✅ ${options.schemaName} | model=${modelId} | ` +
      `tokens=${totalTokens} | latency=${latencyMs}ms`,
    );

    return {
      data: result.object as z.infer<T>,
      source: "llm",
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens,
      },
      latencyMs,
      errorMessage: null,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[LLM] ❌ ${options.schemaName} | model=${modelId} | ` +
      `error="${errorMessage}" | latency=${latencyMs}ms | ` +
      `returning fallback`,
    );

    return {
      data: options.fallback,
      source: "fallback",
      usage: null,
      latencyMs,
      errorMessage: errorMessage,
    };
  }
}
