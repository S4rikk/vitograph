/**
 * AI Output Schemas — Zod schemas for LLM structured outputs
 *
 * These schemas are passed to `generateObject()` (Vercel AI SDK)
 * which sends them as JSON Schema to OpenAI. The LLM response
 * is validated against these schemas at runtime.
 *
 * IMPORTANT: These are SEPARATE from the API request/response
 * schemas in `meal.schemas.ts`. API schemas validate user input;
 * these schemas validate LLM output.
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════
// §1  Psychological Response (Sync)
// ═══════════════════════════════════════════════════════════════════════

/** Zod schema for the CBT-framed psychological chat response. */
export const PsychologicalOutputSchema = z.object({
  /** The chat message text (2-3 sentences, in Russian). */
  message: z
    .string()
    .describe("Chat message for the user, 2-3 sentences, in Russian"),

  /** CBT strategy used to frame the response. */
  strategy: z
    .enum([
      "encouragement",
      "gentle_redirect",
      "cbt_reframe",
      "neutral_acknowledgment",
      "celebration",
    ])
    .describe("CBT framing strategy applied"),

  /** Up to 2 healthier alternative suggestions (in Russian). */
  alternatives: z
    .array(z.string())
    .max(2)
    .describe("Healthier alternatives, max 2 items, in Russian"),

  /** AI confidence in the assessment (0.0–1.0). */
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
});

export type PsychologicalOutput = z.infer<typeof PsychologicalOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════
// §2  Symptom Correlation (Async)
// ═══════════════════════════════════════════════════════════════════════

/** Single food → symptom correlation detected by the AI. */
const CorrelationItemSchema = z.object({
  foodName: z.string().describe("Food item triggering the symptom"),
  symptomName: z.string().describe("Recurring symptom name"),
  occurrenceCount: z
    .number()
    .int()
    .min(0)
    .describe("Co-occurrence count"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Statistical confidence 0.0–1.0"),
  avgOnsetDelayMinutes: z
    .number()
    .min(0)
    .describe("Average onset delay in minutes"),
  explanation: z
    .string()
    .describe("Human-readable explanation of the pattern"),
});

/** Full correlation analysis output from the LLM. */
export const CorrelationOutputSchema = z.object({
  correlations: z
    .array(CorrelationItemSchema)
    .describe("Detected food-symptom correlations, min 3 occurrences"),
  confoundingFactors: z
    .array(z.string())
    .describe("Possible confounding factors"),
  dataQualityNote: z
    .string()
    .describe("Note about data quality and coverage"),
});

export type CorrelationOutput = z.infer<typeof CorrelationOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════
// §3  Diagnostic Hypothesis (Async)
// ═══════════════════════════════════════════════════════════════════════

/** A specific lab test recommended by the AI. */
const RecommendedTestSchema = z.object({
  biomarkerCode: z
    .string()
    .describe("Biomarker code matching Biomarker.code in DB"),
  testName: z.string().describe("Human-readable test name"),
  rationale: z.string().describe("Why this test is relevant"),
  priority: z
    .enum(["urgent", "routine", "optional"])
    .describe("Clinical urgency level"),
});

/** Single diagnostic hypothesis with reasoning chain. */
const HypothesisItemSchema = z.object({
  hypothesis: z
    .string()
    .describe("Suspected condition, e.g. 'Lactose malabsorption'"),
  evidenceLevel: z
    .enum(["strong", "moderate", "weak"])
    .describe("Strength of evidence"),
  recommendedTests: z
    .array(RecommendedTestSchema)
    .describe("Lab tests to confirm or rule out"),
  reasoning: z
    .string()
    .describe("Step-by-step clinical reasoning chain"),
});

/** Full diagnostic output from the LLM. */
export const DiagnosticOutputSchema = z.object({
  hypotheses: z
    .array(HypothesisItemSchema)
    .describe("Diagnostic hypotheses with recommended tests"),
});

export type DiagnosticOutput = z.infer<typeof DiagnosticOutputSchema>;
