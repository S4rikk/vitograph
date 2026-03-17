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
import { openai, createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

// ── Configuration ───────────────────────────────────────────────────

/** Default model for all LLM calls. */
const DEFAULT_MODEL = "gpt-4o";

/** Custom Router for Gemini-3.1-Pro-Thinking */
const routerProvider = createOpenAI({
  baseURL: "https://api.ourzhishi.top/v1",
  apiKey: process.env.GEMINI_API || "",
});

/** Router Health State (Simplified Circuit Breaker) */
const routerHealth = {
  isHealthy: true,
  lastFailureTime: 0,
  COOLDOWN_MS: 300_000, // 5 minutes
};

/**
 * Checks if the router is healthy.
 * Resets health after cooldown period.
 */
function isRouterHealthy(): boolean {
  if (!routerHealth.isHealthy) {
    const timeSinceFailure = Date.now() - routerHealth.lastFailureTime;
    if (timeSinceFailure > routerHealth.COOLDOWN_MS) {
      routerHealth.isHealthy = true;
      console.log("[LLM:HEALTH] 🛡️ Circuit breaker reset. Router is back in service.");
    }
  }
  return routerHealth.isHealthy;
}

/** Trips the circuit breaker. */
function tripRouterCircuit(error: string): void {
  routerHealth.isHealthy = false;
  routerHealth.lastFailureTime = Date.now();
  console.warn(`[LLM:FAILOVER] ⚠️ Router failed (${error}). Tripping circuit breaker for 5m.`);
}

/** Timeout presets: sync (user-facing) vs async (background). */
export const LLM_TIMEOUTS = {
  /** User is waiting for chat response — keep fast. */
  sync: 15_000,
  /** Background analysis — can take longer. */
  async: 30_000,
  /** Failover limit for router attempt. */
  router: 120_000, // 2 minutes — Mandatory for stable medical analysis
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
  /** Optional: Force routing to custom router (defaults to true for non-excluded tasks). */
  readonly useRouter?: boolean;
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
 * Supports routing and failover logic.
 */
export async function callLlmStructured<T extends AnyZodObject>(
  options: LlmCallOptions<T>,
): Promise<LlmCallResult<z.infer<T>>> {
  const startTime = Date.now();

  // 1. Determine Routing Policy
  const EXCLUDED_SCHEMAS = [
    "food_recognition", 
    "nutrition_targets", 
    "lab_diagnostic_report", 
    "somatic_diagnostics",
    "psychological_response",
    "symptom_correlation",
    "diagnostic_hypothesis"
  ];
  const isExcluded = EXCLUDED_SCHEMAS.includes(options.schemaName);
  
  // useRouter defaults to true UNLESS excluded or explicitly disabled
  const shouldTryRouter = options.useRouter !== false && !isExcluded && isRouterHealthy();

  // 2. Initial Attempt (Router or OpenAI)
  const initialProvider = shouldTryRouter ? routerProvider : openai;
  const initialModel = shouldTryRouter 
    ? (options.model ?? "gemini-3.1-pro-preview-thinking") 
    : (options.model ?? DEFAULT_MODEL);
  
  const providerName = shouldTryRouter ? "router" : "openai";

  try {
    // @ts-ignore - maxOutputTokens is supported in AI SDK 6.x but types might be outdated
    const result = await generateObject({
      model: initialProvider(initialModel),
      output: "object" as const,
      schema: options.schema,
      schemaName: options.schemaName,
      system: options.systemPrompt,
      ...(options.messages ? { messages: options.messages as any } : { prompt: options.userMessage as string }),
      // Router calls use 0 retries and capped timeout to fail fast
      maxRetries: shouldTryRouter ? 0 : options.maxRetries,
      abortSignal: AbortSignal.timeout(shouldTryRouter ? Math.min(options.timeoutMs, LLM_TIMEOUTS.router) : options.timeoutMs),
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens,
    });

    return finalizeResult(result, startTime, options.schemaName, providerName, initialModel);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // 3. Failover Logic
    if (shouldTryRouter) {
      tripRouterCircuit(errorMessage);
      const failoverModel = "gpt-4o-mini";
      console.log(`[LLM:FAILOVER] 🔄 Retrying via ${failoverModel}...`);
      
      try {
        // @ts-ignore - maxOutputTokens is supported in AI SDK 6.x but types might be outdated
        const failoverResult = await generateObject({
          model: openai(failoverModel),
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

        return finalizeResult(failoverResult, startTime, options.schemaName, "openai", failoverModel);
      } catch (failoverError: unknown) {
        return handleFinalFailure(failoverError, startTime, options.schemaName, failoverModel, options.fallback);
      }
    }

    // Direct failure (already on OpenAI or router explicitly bypassed)
    return handleFinalFailure(error, startTime, options.schemaName, initialModel, options.fallback);
  }
}

/** Formats the successful LLM result. */
function finalizeResult(result: any, startTime: number, schemaName: string, provider: string, model: string) {
  const latencyMs = Date.now() - startTime;
  const totalTokens = (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

  console.log(
    `[LLM] ✅ ${schemaName} | provider=${provider} | model=${model} | ` +
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
