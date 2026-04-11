/**
 * LLM Client — Central wrapper for Vercel AI SDK calls
 *
 * Provides a single entry point for all LLM interactions with:
 * - Configurable retry logic (maxRetries)
 * - Timeout control via AbortSignal
 * - Structured logging of every call (model, tokens, latency)
 * - Graceful fallback on failure
 *
 * ARCHITECTURE:
 *   All AI trigger services call → callLlmStructured<T>()
 *     → generateObject() from Vercel AI SDK
 *       → OpenAI GPT-4o with Zod schema validation
 *
 * PATTERNS APPLIED (from llm-app-patterns skill):
 * - Rate Limiting & Retry (§5.2): exponential backoff via SDK
 * - Fallback Strategy (§5.3): graceful degradation on failure
 * - Logging & Tracing (§4.2): structured call logging
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// ── Configuration ───────────────────────────────────────────────────

/**
 * Fetches the default diary model from the database, cached for 5 minutes.
 * Uses graceful degradation to fall back to the built-in mini model.
 */
const getDiaryLlmModel = unstable_cache(
  async (): Promise<string> => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return "gpt-5.4-mini";

      const supabase = createClient(url, key);
      const { data, error } = await supabase
        .from("_app_config")
        .select("value")
        .eq("key", "diary_llm")
        .single();
        
      if (error || !data) return "gpt-5.4-mini";
      return data.value;
    } catch {
      return "gpt-5.4-mini";
    }
  },
  ['global_app_config_diary_llm'],
  { revalidate: 300 } // 5 minutes TTL
);

/** Default fallback model if database fetch fails. */
const FALLBACK_DEFAULT_MODEL = "gpt-5.4-mini";

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

/** Options for a structured LLM call. */
export interface LlmCallOptions<T extends z.ZodType> {
  /** Zod schema defining the expected output structure. */
  readonly schema: T;
  /** Human-readable name for the schema (improves OpenAI structured output). */
  readonly schemaName: string;
  /** System prompt defining the AI's role and constraints. */
  readonly systemPrompt: string;
  /** User message containing the data to analyze. */
  readonly userMessage: string;
  /** Timeout in milliseconds. Use LLM_TIMEOUTS presets. */
  readonly timeoutMs: number;
  /** Maximum number of retries. Use LLM_RETRIES presets. */
  readonly maxRetries: number;
  /** Fallback value returned if LLM call fails entirely. */
  readonly fallback: z.infer<T>;
  /** Optional model override (defaults to gpt-5.4-mini). */
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
  /** Token usage (null if fallback). */
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  } | null;
  /** Latency in milliseconds. */
  readonly latencyMs: number;
}

// ── Core Function ───────────────────────────────────────────────────

/**
 * Calls an LLM with structured output validation via Zod.
 *
 * Uses Vercel AI SDK `generateObject()` which:
 * 1. Sends the Zod schema as JSON Schema to OpenAI
 * 2. OpenAI returns structured JSON matching the schema
 * 3. SDK validates the response against the Zod schema
 * 4. Returns a fully typed TypeScript object
 *
 * On failure (timeout, rate limit, invalid response), returns
 * the provided fallback value instead of throwing.
 *
 * @param options - Configuration for the LLM call
 * @returns Typed result with metadata (source, usage, latency)
 */
export async function callLlmStructured<T extends z.ZodType>(
  options: LlmCallOptions<T>,
): Promise<LlmCallResult<z.infer<T>>> {
  const startTime = Date.now();
  const modelId = options.model ?? await getDiaryLlmModel();

  try {
    const result = await generateObject({
      model: openai(modelId),
      schema: options.schema,
      schemaName: options.schemaName,
      system: options.systemPrompt,
      prompt: options.userMessage,
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
    };
  } catch (error) {
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
    };
  }
}
