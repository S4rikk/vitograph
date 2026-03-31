/**
 * Request Validation Schemas — Zod schemas for incoming API bodies.
 *
 * Each schema validates the `req.body` BEFORE the controller runs.
 * If validation fails, the `validate()` middleware returns 400
 * with field-level error details.
 */

import { z } from "zod";

// ── POST /api/v1/ai/chat ────────────────────────────────────────────

/** Schema for the generic conversational chat endpoint using LangGraph. */
export const ChatRequestSchema = z.object({
  /** The message sent by the user. */
  message: z
    .string()
    .min(1, "Message is required")
    .max(1000, "Message must be ≤1000 characters"),

  /** Optional image URL associated with this chat message */
  imageUrl: z.string().optional(),

  /** Optional base64 encoded image string (e.g., from a food label photo) */
  imageBase64: z.string().optional(),

  /** Unique identifier for the conversation thread to maintain state/memory. */
  threadId: z.string().min(1, "threadId is required"),

  /** Chat mode: 'diary' for food logging context, 'assistant' for general AI Friend chat */
  chatMode: z.enum(["diary", "assistant"]).default("diary").optional(),

  /** Optional user profile overrides for personalization. */
  userProfile: z
    .object({
      age: z.number().optional(),
      biologicalSex: z.string().nullable().optional(),
      dietType: z.string().nullable().optional(),
      chronicConditions: z.array(z.string()).optional(),
      activityLevel: z.string().nullable().optional(),
      is_smoker: z.boolean().optional(),
      is_pregnant: z.boolean().optional(),
    })
    .optional(),
  
  /** Optional nutritional context from Vision analysis (Phase 54) */
  nutritionalContext: z.any().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ── POST /api/v1/ai/analyze ─────────────────────────────────────────

/** Single symptom entry for correlation analysis. */
const SymptomEntrySchema = z.object({
  foodName: z.string().min(1),
  symptomName: z.string().min(1),
  severity: z.number().int().min(1).max(10),
  onsetDelayMinutes: z.number().min(0).nullable(),
  loggedAt: z.string().datetime({ message: "ISO 8601 datetime required" }),
});

/** Schema for the symptom correlation analysis endpoint. */
export const AnalyzeRequestSchema = z.object({
  /** Array of symptom entries (minimum 5 for meaningful analysis). */
  symptoms: z
    .array(SymptomEntrySchema)
    .min(1, "At least 1 symptom entry required"),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ── POST /api/v1/ai/diagnose ────────────────────────────────────────

/** Existing biomarker result for diagnostic context. */
const BiomarkerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  value: z.number(),
});

/** Schema for the diagnostic hypothesis endpoint. */
export const DiagnoseRequestSchema = z.object({
  /** Symptom entries to analyze. */
  symptoms: z
    .array(SymptomEntrySchema)
    .min(1, "At least 1 symptom entry required"),

  /** Optional existing biomarker results for context. */
  biomarkers: z.array(BiomarkerSchema).optional(),
});

export type DiagnoseRequest = z.infer<typeof DiagnoseRequestSchema>;

// ── POST /api/v1/ai/analyze-somatic ─────────────────────────────────

/** Schema for analyzing a base64 photo of body parts (nails, tongue, skin). */
export const AnalyzeSomaticRequestSchema = z.object({
  /** Base64 encoded image string starting with data:image/... */
  imageBase64: z.string().min(1, "Base64 image is required"),

  /** Type of somatic analysis */
  type: z.enum(["nails", "tongue", "skin"]),

  /** Thread ID to continue the conversation in the diary or assistant mode */
  threadId: z.string().optional(),
});

export type AnalyzeSomaticRequest = z.infer<typeof AnalyzeSomaticRequestSchema>;

// ── POST /api/v1/ai/analyze-food ────────────────────────────────────

/** Schema for analyzing a base64 photo of food. */
export const AnalyzeFoodRequestSchema = z.object({
  /** Base64 encoded image string starting with data:image/... */
  imageBase64: z.string().min(100, "Base64 image is required"),
});

export type AnalyzeFoodRequest = z.infer<typeof AnalyzeFoodRequestSchema>;

// ── POST /api/v1/ai/vision/label ────────────────────────────────────

/** Schema for analyzing a base64 photo of a food label/ingredients. */
export const AnalyzeLabelRequestSchema = z.object({
  /** Base64 encoded image string starting with data:image/... */
  imageBase64: z.string().min(100, "Base64 image is required"),
});

export type AnalyzeLabelRequest = z.infer<typeof AnalyzeLabelRequestSchema>;

// ── GET /api/v1/ai/chat/history ───────────────────────────────
// No specific body parsing needed for GET, but we leave this comment to mark the boundary

// ── POST /api/v1/ai/analyze-lab-report ──────────────────────────────

/** Reference Range schema */
const ReferenceRangeSchema = z.object({
  low: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  text: z.string().nullable().optional(),
});

/** Biomarker entry from the Python parser for diagnostic analysis. */
const LabBiomarkerSchema = z.object({
  original_name: z.string().min(1),
  standardized_slug: z.string().min(1),
  value_numeric: z.number().nullable().optional(),
  value_string: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  reference_range: ReferenceRangeSchema.nullable().optional(),
  flag: z.string().nullable().optional(),
  ai_clinical_note: z.string().nullable().optional(),
});

/** Schema for the lab report diagnostic analysis endpoint. */
export const AnalyzeLabReportRequestSchema = z.object({
  /** Parsed biomarker results (minimum 1 for meaningful analysis). */
  biomarkers: z
    .array(LabBiomarkerSchema)
    .min(1, "At least 1 biomarker required for analysis"),
});

export type AnalyzeLabReportRequest = z.infer<typeof AnalyzeLabReportRequestSchema>;

// ── PATCH /api/v1/ai/meal-log/:id ───────────────────────────────────

/** Schema for updating meal log weight (Phase 56) */
export const UpdateMealLogSchema = z.object({
  /** New total weight of the meal in grams */
  new_weight_g: z.number().positive("Weight must be positive"),
});

export type UpdateMealLogRequest = z.infer<typeof UpdateMealLogSchema>;
