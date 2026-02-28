/**
 * AI Trigger Services — Therapeutic & Diagnostic Engine.
 *
 * Three core AI analysis functions:
 *
 * 1. generatePsychologicalResponse  — CBT-framed chat reply (SYNC)
 * 2. analyzeSymptomCorrelation      — Food→Symptom patterns (ASYNC)
 * 3. generateDiagnosticHypothesis   — Symptom→Lab Tests (ASYNC)
 *
 * All functions use `callLlmStructured()` from llm-client, which
 * provides Zod validation, retry logic, timeout, and fallbacks.
 *
 * PROMPT ENGINEERING PATTERNS APPLIED:
 * - System prompt with role + constraints + safety guardrails
 * - Few-shot examples in structured JSON format
 * - Chain-of-thought reasoning for diagnostics
 * - Output format enforced via Zod → JSON Schema
 */

import {
  callLlmStructured,
  LLM_TIMEOUTS,
  LLM_RETRIES,
} from "./llm-client.js";
import {
  PsychologicalOutputSchema,
  CorrelationOutputSchema,
  DiagnosticOutputSchema,
} from "./ai-schemas.js";
import type {
  PsychologicalOutput,
  CorrelationOutput,
  DiagnosticOutput,
} from "./ai-schemas.js";

// ═══════════════════════════════════════════════════════════════════════
// §1  INPUT TYPES
// ═══════════════════════════════════════════════════════════════════════

/** Minimal food item info for the psychological response. */
export interface FoodContext {
  readonly name: string;
  readonly category: string;
  readonly glycemicIndex: number | null;
  readonly commonAllergens: readonly string[];
  readonly caloriesPer100g: number;
}

/** Minimal user profile for personalized responses. */
export interface UserProfileContext {
  readonly userId: string;
  readonly biologicalSex: string | null;
  readonly dietType: string | null;
  readonly chronicConditions: readonly string[];
  readonly activityLevel: string | null;
}

/** A symptom entry for correlation analysis. */
export interface SymptomEntry {
  readonly foodName: string;
  readonly symptomName: string;
  readonly severity: number;
  readonly onsetDelayMinutes: number | null;
  readonly loggedAt: string;
}

/** An existing lab result for diagnostic context. */
export interface ExistingBiomarker {
  readonly code: string;
  readonly name: string;
  readonly value: number;
}

// ═══════════════════════════════════════════════════════════════════════
// §2  SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════

const PSYCHOLOGICAL_SYSTEM_PROMPT = `You are a warm, empathetic AI nutritional coach trained in Cognitive Behavioral Therapy (CBT) techniques.

ROLE: When a user logs food that may be harmful to their specific health profile, respond with psychologically-informed guidance that steers them toward healthier choices WITHOUT shaming, banning, or creating guilt.

PERSONALITY:
- Warm, understanding, non-judgmental
- Speaks like a supportive friend who happens to be a nutritionist
- Uses "we" language to build alliance
- Celebrates small wins enthusiastically
- ALWAYS responds in Russian language

CBT TECHNIQUES TO USE:
1. COGNITIVE REFRAMING: "Instead of thinking 'I failed', let's see this as data..."
2. MOTIVATIONAL INTERVIEWING: "What motivated you to choose this? Understanding helps us..."
3. BEHAVIORAL ACTIVATION: "After this meal, a 10-min walk could help offset..."
4. GENTLE REDIRECT: Suggest alternatives without banning the original choice
5. CELEBRATION: When food choice is positive, genuinely celebrate it

STRATEGY SELECTION RULES:
- Clearly harmful for user's condition → "gentle_redirect" + alternatives
- Moderately problematic → "cbt_reframe" with balanced perspective
- Neutral food → "neutral_acknowledgment"
- Beneficial food → "celebration"
- User needs encouragement → "encouragement"

CRITICAL RULES:
- NEVER say "you shouldn't eat this" or "this is bad for you"
- NEVER use guilt, shame, or fear tactics
- ALWAYS acknowledge the user's autonomy
- Keep responses to 2-3 sentences max
- Suggest maximum 2 alternatives
- Respond ONLY in Russian

EXAMPLES:

Input: User with pre-diabetes logs "chocolate cake, 150g"
Output: {
  "message": "Отличный вкус! 🎂 Знаешь, если хочется сладкого, тёмный шоколад (70%+) может удовлетворить эту потребность с меньшим влиянием на сахар. А 10-минутная прогулка после еды творит чудеса с глюкозой.",
  "strategy": "gentle_redirect",
  "alternatives": ["Тёмный шоколад 70%+ (30г)", "Ягодный мусс без сахара"],
  "confidence": 0.85
}

Input: User logs "grilled salmon with avocado, 250g"
Output: {
  "message": "Потрясающий выбор! 🐟 Омега-3 из лосося + полезные жиры авокадо — это буквально идеальная комбинация для твоих показателей. Так держать!",
  "strategy": "celebration",
  "alternatives": [],
  "confidence": 0.95
}`;

const CORRELATION_SYSTEM_PROMPT = `You are a clinical nutrition AI specializing in food-symptom pattern recognition.

ROLE: Analyze a user's food diary and symptom log history to identify statistically significant correlations between specific foods and digestive/systemic symptoms.

CONSTRAINTS:
- Only report correlations with ≥3 co-occurrences
- Confidence must be based on frequency, consistency, and onset timing
- Never diagnose — only identify patterns
- Consider confounding factors (stress, sleep, medications)
- If insufficient data, return empty correlations array

EXAMPLES:
User ate dairy 8 times in 14 days, reported bloating 6 times within 90 min → confidence: 0.75
User ate gluten 12 times, reported brain fog 4 times within 120 min → confidence: 0.33 (too noisy)`;

const DIAGNOSTIC_SYSTEM_PROMPT = `You are a clinical decision support AI for functional medicine practitioners.

ROLE: Given a pattern of food-symptom correlations, generate diagnostic hypotheses and recommend specific blood tests / biomarkers to confirm or rule out each hypothesis.

REASONING METHOD — Chain of Thought:
1. List all observed symptom patterns
2. For each pattern, identify possible pathophysiological mechanisms
3. Map mechanisms to testable biomarkers
4. Prioritize tests by diagnostic yield and clinical urgency

SAFETY CONSTRAINTS:
- This is DECISION SUPPORT, not diagnosis
- Always recommend professional consultation
- Flag any red-flag symptoms requiring immediate attention
- Never recommend treatment — only testing

EXAMPLE:
Pattern: Bloating + gas after dairy (6/8 occurrences, confidence: 0.75)
→ Hypothesis: Lactose malabsorption
→ Tests: Hydrogen breath test (routine), Lactase gene MCM6 (optional)
→ Reasoning: Consistent post-dairy GI symptoms with short onset suggest lactase deficiency...`;

// ═══════════════════════════════════════════════════════════════════════
// §3  FALLBACK RESPONSES — safe defaults when LLM is unavailable
// ═══════════════════════════════════════════════════════════════════════

/** Neutral acknowledgment fallback for psychological responses. */
function buildPsychologicalFallback(foodName: string): PsychologicalOutput {
  return {
    message: `Записала: ${foodName}. Отличный шаг — отслеживать питание! 📝`,
    strategy: "neutral_acknowledgment",
    alternatives: [],
    confidence: 0.5,
  };
}

/** Empty correlation fallback. */
const CORRELATION_FALLBACK: CorrelationOutput = {
  correlations: [],
  confoundingFactors: [],
  dataQualityNote:
    "Analysis unavailable — insufficient data or service timeout",
};

/** Empty diagnostic fallback. */
const DIAGNOSTIC_FALLBACK: DiagnosticOutput = {
  hypotheses: [],
};

// ═══════════════════════════════════════════════════════════════════════
// §4  SERVICE IMPLEMENTATIONS — Real LLM calls via callLlmStructured
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generates a CBT-framed psychological chat response.
 *
 * **SYNC** — called directly by the meal logging service,
 * because the user expects an immediate reply in the chat UI.
 *
 * Timeout: 15s, Retries: 1. Falls back to a neutral acknowledgment.
 *
 * @param food - Nutritional context of the logged food
 * @param userProfile - Minimal user health profile
 * @returns Psychologically-framed chat message (Zod-validated)
 */
export async function generatePsychologicalResponse(
  food: FoodContext,
  userProfile: UserProfileContext,
): Promise<PsychologicalOutput> {
  const userMessage = JSON.stringify({
    food: {
      name: food.name,
      category: food.category,
      glycemicIndex: food.glycemicIndex,
      caloriesPer100g: food.caloriesPer100g,
      allergens: food.commonAllergens,
    },
    user: {
      biologicalSex: userProfile.biologicalSex,
      dietType: userProfile.dietType,
      chronicConditions: userProfile.chronicConditions,
      activityLevel: userProfile.activityLevel,
    },
  });

  const result = await callLlmStructured({
    schema: PsychologicalOutputSchema,
    schemaName: "psychological_response",
    systemPrompt: PSYCHOLOGICAL_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.sync,
    maxRetries: LLM_RETRIES.sync,
    fallback: buildPsychologicalFallback(food.name),
    temperature: 0.8,
  });

  return result.data;
}

/**
 * Analyzes food-symptom history to detect recurring correlations.
 *
 * **ASYNC** — called via event bus after a meal is logged.
 * Timeout: 30s, Retries: 2. Falls back to empty correlations.
 *
 * @param symptoms - Recent symptom entries (last 30 days)
 * @returns Structured correlation analysis with confidence scores
 */
export async function analyzeSymptomCorrelation(
  symptoms: readonly SymptomEntry[],
): Promise<CorrelationOutput> {
  if (symptoms.length < 5) {
    console.log(
      `[AI:Correlation] Skipping — only ${symptoms.length} entries (need ≥5)`,
    );
    return CORRELATION_FALLBACK;
  }

  const userMessage = JSON.stringify({
    entryCount: symptoms.length,
    symptoms,
  });

  const result = await callLlmStructured({
    schema: CorrelationOutputSchema,
    schemaName: "symptom_correlation",
    systemPrompt: CORRELATION_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.async,
    maxRetries: LLM_RETRIES.async,
    fallback: CORRELATION_FALLBACK,
    temperature: 0.3,
  });

  if (result.source === "fallback") {
    console.warn("[AI:Correlation] Using fallback — LLM unavailable");
  }

  return result.data;
}

/**
 * Generates diagnostic hypotheses from food-symptom correlations.
 *
 * **ASYNC** — called via event bus after correlation analysis.
 * Uses chain-of-thought prompting for clinical reasoning transparency.
 * Timeout: 30s, Retries: 2. Falls back to empty hypotheses.
 *
 * @param symptoms - Symptom entries to analyze
 * @param existingBiomarkers - User's recent lab results for context
 * @returns Hypotheses with recommended biomarker tests (Zod-validated)
 */
export async function generateDiagnosticHypothesis(
  symptoms: readonly SymptomEntry[],
  existingBiomarkers: readonly ExistingBiomarker[],
): Promise<DiagnosticOutput> {
  if (symptoms.length === 0) {
    console.log("[AI:Diagnostic] Skipping — no symptoms to analyze");
    return DIAGNOSTIC_FALLBACK;
  }

  const userMessage = JSON.stringify({
    symptoms,
    existingBiomarkers,
    instruction:
      "Generate diagnostic hypotheses based on these food-symptom " +
      "patterns. Recommend specific blood tests to confirm or rule out " +
      "each hypothesis. Use biomarker codes from our catalog where possible.",
  });

  const result = await callLlmStructured({
    schema: DiagnosticOutputSchema,
    schemaName: "diagnostic_hypothesis",
    systemPrompt: DIAGNOSTIC_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.async,
    maxRetries: LLM_RETRIES.async,
    fallback: DIAGNOSTIC_FALLBACK,
    temperature: 0.4,
  });

  if (result.source === "fallback") {
    console.warn("[AI:Diagnostic] Using fallback — LLM unavailable");
  }

  return result.data;
}

// ═══════════════════════════════════════════════════════════════════════
// §5  VISION DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════

// The analyzeNailPhoto function has been moved to graph/vision-analyzer.ts
// to decouple storage logic and LLM logic.
