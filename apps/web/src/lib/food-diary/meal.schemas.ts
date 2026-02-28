/**
 * Zod Validation Schemas — Food Diary
 *
 * Strict runtime validation for meal log API input/output.
 * All schemas are exported as both Zod objects and inferred TypeScript types.
 */

import { z } from "zod";

// ── Request Schemas ─────────────────────────────────────────────────

/** Individual symptom reported alongside a meal. */
export const SymptomInputSchema = z.object({
  /** Symptom name (e.g., "bloating", "brain_fog", "heartburn"). */
  name: z
    .string()
    .min(1, "Symptom name is required")
    .max(100, "Symptom name too long"),

  /** Severity: 1 (mild) → 10 (severe). */
  severity: z
    .number()
    .int()
    .min(1, "Severity must be at least 1")
    .max(10, "Severity must be at most 10"),

  /** Minutes between meal consumption and symptom onset. */
  onsetDelayMinutes: z
    .number()
    .int()
    .min(0, "Onset delay cannot be negative")
    .max(1440, "Onset delay cannot exceed 24 hours")
    .optional(),
});

/** Full request body for `POST /api/meals/log`. */
export const LogMealRequestSchema = z.object({
  /** Name of the dish or food item (free-text, AI-resolved). */
  dishName: z
    .string()
    .min(1, "Dish name is required")
    .max(200, "Dish name too long"),

  /** Weight in grams. */
  weightGrams: z
    .number()
    .positive("Weight must be positive")
    .max(10000, "Weight cannot exceed 10 kg"),

  /** Meal type: breakfast, lunch, dinner, snack, or drink. */
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "drink"]),

  /** Optional free-form notes. */
  notes: z.string().max(500, "Notes too long").optional(),

  /** Symptoms experienced during or shortly after eating. */
  symptoms: z.array(SymptomInputSchema).max(10).optional(),
});

// ── Response Schemas ────────────────────────────────────────────────

/** AI psychological response included in the API response. */
export const AiChatResponseSchema = z.object({
  /** The chat message text to display to the user. */
  message: z.string(),

  /** Framing strategy used by the AI (for analytics/debugging). */
  strategy: z.enum([
    "encouragement",
    "gentle_redirect",
    "cbt_reframe",
    "neutral_acknowledgment",
    "celebration",
  ]),

  /** Optional suggested healthier alternatives. */
  alternatives: z.array(z.string()).optional(),

  /** Confidence of the AI assessment (0.0–1.0). */
  confidence: z.number().min(0).max(1),
});

/** Full response body for `POST /api/meals/log`. */
export const LogMealResponseSchema = z.object({
  /** Persisted meal log ID. */
  mealId: z.number(),

  /** Meal log timestamp. */
  loggedAt: z.string().datetime(),

  /** Computed total calories (from food DB, may be null if food unknown). */
  totalCalories: z.number().nullable(),

  /** Whether symptoms were recorded alongside this meal. */
  hasSymptoms: z.boolean(),

  /** Immediate AI chat response (sync — user sees this in chat). */
  aiResponse: AiChatResponseSchema,
});

// ── Inferred Types ──────────────────────────────────────────────────

export type SymptomInput = z.infer<typeof SymptomInputSchema>;
export type LogMealRequest = z.infer<typeof LogMealRequestSchema>;
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;
export type LogMealResponse = z.infer<typeof LogMealResponseSchema>;
