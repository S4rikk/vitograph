/**
 * AI Trigger Services — Therapeutic & Diagnostic Engine
 *
 * Three core AI analysis functions triggered by the Food Diary:
 *
 * 1. analyzeSymptomCorrelation   — Pattern detection (Food X → Symptom Y)
 * 2. generateDiagnosticHypothesis — Reverse diagnostics (Symptom → Lab Tests)
 * 3. generatePsychologicalResponse — CBT-framed chat reply for harmful foods
 *
 * All functions use the Vercel AI SDK `generateObject()` via the
 * `callLlmStructured()` wrapper, which provides:
 * - Zod schema validation of LLM output
 * - Retry logic with configurable maxRetries
 * - Timeout control via AbortSignal
 * - Graceful fallback on failure
 * - Structured logging (model, tokens, latency)
 *
 * PROMPT ENGINEERING PATTERNS APPLIED:
 * - System prompt with role + constraints + safety guardrails
 * - Few-shot examples in structured format
 * - Chain-of-thought reasoning for diagnostics
 * - Output format enforced via Zod → JSON Schema
 */

import type { MealLoggedEvent } from "./health-event-bus";
import { healthEventBus } from "./health-event-bus";
import {
  callLlmStructured,
  LLM_TIMEOUTS,
  LLM_RETRIES,
} from "./llm-client";
import {
  PsychologicalOutputSchema,
  CorrelationOutputSchema,
  DiagnosticOutputSchema,
} from "./ai-schemas";
import type {
  PsychologicalOutput,
  CorrelationOutput,
  DiagnosticOutput,
} from "./ai-schemas";

// ═══════════════════════════════════════════════════════════════════════
// §1  TYPES — Shared interfaces for AI service outputs
// ═══════════════════════════════════════════════════════════════════════

/** A detected food → symptom correlation pattern. */
export interface CorrelationResult {
  /** The food item name triggering the symptom. */
  readonly foodName: string;
  /** The symptom consistently appearing after this food. */
  readonly symptomName: string;
  /** How many times this pair has co-occurred. */
  readonly occurrenceCount: number;
  /** Statistical confidence (0.0–1.0). */
  readonly confidence: number;
  /** Average onset delay in minutes. */
  readonly avgOnsetDelayMinutes: number;
  /** Human-readable explanation for the user. */
  readonly explanation: string;
}

/** A diagnostic hypothesis derived from symptom patterns. */
export interface DiagnosticHypothesis {
  /** Suspected condition or pathology. */
  readonly hypothesis: string;
  /** Evidence strength. */
  readonly evidenceLevel: "strong" | "moderate" | "weak";
  /** Specific biomarkers/lab tests to confirm or rule out. */
  readonly recommendedTests: readonly RecommendedTest[];
  /** AI reasoning chain (for transparency/audit). */
  readonly reasoning: string;
}

/** A specific lab test the AI recommends. */
export interface RecommendedTest {
  /** Biomarker code (matches Biomarker.code in Prisma). */
  readonly biomarkerCode: string;
  /** Human-readable test name. */
  readonly testName: string;
  /** Why this test is relevant. */
  readonly rationale: string;
  /** Urgency level. */
  readonly priority: "urgent" | "routine" | "optional";
}

/** Psychological response for the chat UI. */
export interface PsychologicalResponse {
  /** The message to display in chat. */
  readonly message: string;
  /** Framing strategy used. */
  readonly strategy:
  | "encouragement"
  | "gentle_redirect"
  | "cbt_reframe"
  | "neutral_acknowledgment"
  | "celebration";
  /** Optional healthier alternatives. */
  readonly alternatives: readonly string[];
  /** AI confidence in the assessment (0.0–1.0). */
  readonly confidence: number;
}

/** Minimal food item info passed to the psychological response service. */
export interface FoodContext {
  readonly name: string;
  readonly category: string;
  readonly glycemicIndex: number | null;
  readonly commonAllergens: readonly string[];
  readonly caloriesPer100g: number;
}

/** Minimal user profile info for personalized responses. */
export interface UserProfileContext {
  readonly userId: string;
  readonly biologicalSex: string | null;
  readonly dietType: string | null;
  readonly chronicConditions: readonly string[];
  readonly activityLevel: string | null;
}

/** Meal history entry for correlation analysis. */
export interface MealHistoryEntry {
  readonly mealId: number;
  readonly dishName: string;
  readonly mealType: string;
  readonly loggedAt: string;
  readonly symptoms: readonly {
    name: string;
    severity: number;
    onsetDelayMinutes: number | null;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════
// §2  PROMPT TEMPLATES — Structured LLM prompts for each service
// ═══════════════════════════════════════════════════════════════════════

/**
 * System prompt for symptom correlation analysis.
 *
 * PATTERN: Role definition + constraints + few-shot examples.
 */
const SYMPTOM_CORRELATION_SYSTEM_PROMPT = `You are a clinical nutrition AI specializing in food-symptom pattern recognition.

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

/**
 * System prompt for reverse-diagnostic hypothesis generation.
 *
 * PATTERN: Chain-of-thought + structured reasoning + safety guardrails.
 */
const DIAGNOSTIC_HYPOTHESIS_SYSTEM_PROMPT = `You are a clinical decision support AI for functional medicine practitioners.

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

/**
 * System prompt for psychological framing (CBT techniques).
 *
 * PATTERN: Role + personality + technique catalog + few-shot.
 */
const PSYCHOLOGICAL_RESPONSE_SYSTEM_PROMPT = `You are a warm, empathetic AI nutritional coach trained in Cognitive Behavioral Therapy (CBT) techniques.

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
- If food is clearly harmful for user's condition → "gentle_redirect" + alternatives
- If food is moderately problematic → "cbt_reframe" with balanced perspective
- If food is neutral → "neutral_acknowledgment"
- If food is beneficial → "celebration"
- If user just needs encouragement → "encouragement"

CRITICAL RULES:
- NEVER say "you shouldn't eat this" or "this is bad for you"
- NEVER use guilt, shame, or fear tactics
- ALWAYS acknowledge the user's autonomy
- Keep responses to 2-3 sentences max
- Suggest maximum 2 alternatives
- Respond ONLY in Russian
- EXCEPTION: If the user has set an explicit dietary restriction (e.g., "no white sugar") that is provided in context, OVERRIDE the gentle approach. In this case, firmly remind them of their own rule and refuse to encourage the banned product. This is not shaming — the user ASKED you to be strict.

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

// ═══════════════════════════════════════════════════════════════════════
// §3  FALLBACK RESPONSES — Returned when LLM is unavailable
// ═══════════════════════════════════════════════════════════════════════

/** Default psychological fallback: neutral acknowledgment. */
function buildPsychologicalFallback(foodName: string): PsychologicalOutput {
  return {
    message: `Записала: ${foodName}. Отличный шаг — отслеживать питание! 📝`,
    strategy: "neutral_acknowledgment",
    alternatives: [],
    confidence: 0.5,
  };
}

/** Default correlation fallback: no patterns detected. */
const CORRELATION_FALLBACK: CorrelationOutput = {
  correlations: [],
  confoundingFactors: [],
  dataQualityNote: "Analysis unavailable — insufficient data or service timeout",
};

/** Default diagnostic fallback: no hypotheses. */
const DIAGNOSTIC_FALLBACK: DiagnosticOutput = {
  hypotheses: [],
};

// ═══════════════════════════════════════════════════════════════════════
// §4  SERVICE IMPLEMENTATIONS — Real LLM calls
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generates an AI chat response using psychological framing (CBT).
 *
 * SYNC — called directly by MealService (not via event bus),
 * because the user expects an immediate reply in the chat UI.
 *
 * Uses a 15-second timeout with 1 retry for fast UX.
 * On failure, returns a neutral acknowledgment fallback.
 *
 * @param food - Nutritional context of the logged food
 * @param userProfile - Minimal user health profile for personalization
 * @returns Psychologically-framed chat message (typed via Zod schema)
 */
export async function generatePsychologicalResponse(
  food: FoodContext,
  userProfile: UserProfileContext,
): Promise<PsychologicalResponse> {
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
    systemPrompt: PSYCHOLOGICAL_RESPONSE_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.sync,
    maxRetries: LLM_RETRIES.sync,
    fallback: buildPsychologicalFallback(food.name),
    temperature: 0.8,
  });

  return {
    message: result.data.message,
    strategy: result.data.strategy,
    alternatives: result.data.alternatives,
    confidence: result.data.confidence,
  };
}

/**
 * Analyzes the user's meal + symptom history to detect recurring
 * food–symptom correlations.
 *
 * ASYNC — called via event bus, results stored for future queries.
 * Uses a 30-second timeout with 2 retries.
 *
 * @param userId - UUID of the user (for logging)
 * @param mealId - ID of the just-logged meal (for logging)
 * @param history - Recent meal + symptom history (last 30 days)
 * @returns Structured correlation analysis with confidence scores
 */
export async function analyzeSymptomCorrelation(
  userId: string,
  mealId: number,
  history: readonly MealHistoryEntry[],
): Promise<readonly CorrelationResult[]> {
  // Skip analysis if insufficient data
  if (history.length < 5) {
    console.log(
      `[AI:SymptomCorrelation] Skipping — only ${history.length} meals ` +
      `(need ≥5) for user=${userId}`,
    );
    return [];
  }

  const userMessage = JSON.stringify({
    userId,
    mealId,
    mealCount: history.length,
    history,
  });

  const result = await callLlmStructured({
    schema: CorrelationOutputSchema,
    schemaName: "symptom_correlation",
    systemPrompt: SYMPTOM_CORRELATION_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.async,
    maxRetries: LLM_RETRIES.async,
    fallback: CORRELATION_FALLBACK,
    temperature: 0.3,
  });

  if (result.source === "fallback") {
    console.warn(
      `[AI:SymptomCorrelation] Using fallback for user=${userId}, meal=${mealId}`,
    );
  }

  return result.data.correlations;
}

/**
 * Generates diagnostic hypotheses based on accumulated symptom patterns.
 *
 * ASYNC — called via event bus after correlation analysis.
 * Uses chain-of-thought prompting for clinical reasoning transparency.
 * Uses a 30-second timeout with 2 retries.
 *
 * @param userId - UUID of the user (for logging)
 * @param correlations - Detected food-symptom correlations to analyze
 * @param existingBiomarkers - User's recent lab test results for context
 * @returns Array of hypotheses with recommended biomarker tests
 */
export async function generateDiagnosticHypothesis(
  userId: string,
  correlations: readonly CorrelationResult[],
  existingBiomarkers: readonly { code: string; name: string; value: number }[],
): Promise<readonly DiagnosticHypothesis[]> {
  // Skip if no significant correlations found
  if (correlations.length === 0) {
    console.log(
      `[AI:DiagnosticHypothesis] Skipping — no correlations for user=${userId}`,
    );
    return [];
  }

  const userMessage = JSON.stringify({
    userId,
    correlations,
    existingBiomarkers,
    instruction: "Generate diagnostic hypotheses based on the food-symptom " +
      "correlations. Recommend specific blood tests to confirm or rule out " +
      "each hypothesis. Use biomarker codes from our catalog where possible.",
  });

  const result = await callLlmStructured({
    schema: DiagnosticOutputSchema,
    schemaName: "diagnostic_hypothesis",
    systemPrompt: DIAGNOSTIC_HYPOTHESIS_SYSTEM_PROMPT,
    userMessage,
    timeoutMs: LLM_TIMEOUTS.async,
    maxRetries: LLM_RETRIES.async,
    fallback: DIAGNOSTIC_FALLBACK,
    temperature: 0.4,
  });

  if (result.source === "fallback") {
    console.warn(
      `[AI:DiagnosticHypothesis] Using fallback for user=${userId}`,
    );
  }

  return result.data.hypotheses;
}

// ═══════════════════════════════════════════════════════════════════════
// §5  EVENT BUS WIRING — Register async AI triggers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Registers all AI analysis listeners on the health event bus.
 *
 * Call this once at application startup (e.g., in Next.js instrumentation).
 * Each listener runs asynchronously and independently — one failure
 * does not affect others.
 *
 * NOTE: The event bus listeners currently call the AI functions with
 * empty history/correlations arrays. In production, these would first
 * query Prisma for the user's meal history and existing correlations
 * before passing them to the AI functions.
 */
export function registerAiTriggers(): void {
  healthEventBus.on(
    "meal:logged",
    async (event: MealLoggedEvent) => {
      // In production, fetch real history from Prisma:
      // const history = await mealRepository.getRecentHistory(event.userId, 30)
      const history: MealHistoryEntry[] = [];

      // Trigger correlation analysis only if symptoms were reported
      if (event.hasSymptoms) {
        const correlations = await analyzeSymptomCorrelation(
          event.userId,
          event.mealId,
          history,
        );

        // Run diagnostic hypothesis if correlations were found
        if (correlations.length > 0) {
          // In production, fetch real biomarkers from Prisma:
          // const biomarkers = await testResultRepository.getRecent(event.userId)
          const existingBiomarkers: { code: string; name: string; value: number }[] = [];

          await generateDiagnosticHypothesis(
            event.userId,
            correlations,
            existingBiomarkers,
          );
        }
      }
    },
  );

  console.log("[AI:Triggers] Registered meal:logged listeners");
}
