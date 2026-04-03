import {
    callLlmStructured,
    LLM_RETRIES,
} from "../llm-client.js";
import {
    FoodRecognitionOutputSchema,
    type FoodRecognitionOutput,
} from "../ai-schemas.js";
import { FOOD_VISION_PROMPT } from "../prompts/food-vision.prompt.js";
import { validateFoodVision } from "../validators/response-validator.js";

// ── System Prompt (imported from prompts registry) ──────────────────
// See: prompts/food-vision.prompt.ts for the full prompt text + few-shot examples.

// ── Fallback ────────────────────────────────────────────────────────

const FOOD_VISION_FALLBACK: FoodRecognitionOutput = {
    items: [],
    supplements: [],
    meal_summary: {
        total_calories_kcal: 0,
        total_protein_g: 0,
        total_fat_g: 0,
        total_carbs_g: 0,
    },
    meal_quality_score: 50,
    meal_quality_reason: "Не удалось оценить качество еды.",
    health_reaction: "Не удалось проанализировать фото в данный момент.",
    reaction_type: "neutral",
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Invokes GPT-4o Vision to analyze a food photo and return
 * structured nutritional data with a personalized health reaction.
 *
 * @param imageUrl - Public URL of the uploaded food photo
 * @param userContext - Serialized user health context (profile, deficits, restrictions)
 * @returns Object with data and optional error message
 */
export async function runFoodVisionAnalyzer(
    imageUrl: string,
    userContext: string,
): Promise<{ data: FoodRecognitionOutput; errorMessage: string | null }> {
    const systemPrompt = FOOD_VISION_PROMPT.template.replace(
        "{userContext}",
        userContext,
    );

    const messages = [
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: "Please analyze this photo of food. Identify all dishes, estimate weights, and calculate full nutritional breakdown.",
                },
                { type: "image", image: new URL(imageUrl) },
            ],
        },
    ];

    const result = await callLlmStructured({
        schema: FoodRecognitionOutputSchema,
        schemaName: "food_recognition",
        systemPrompt,
        messages,
        timeoutMs: 60_000, // Vision + complex schema needs more time than default
        maxRetries: LLM_RETRIES.async,
        fallback: FOOD_VISION_FALLBACK,
        temperature: 0.3, // Factual accuracy with slight flexibility for portion estimation
    });

    if (result.source === "fallback") {
        console.warn(`[AI:FoodVision] Using fallback — error: ${result.errorMessage}`);
    } else {
        // Post-LLM validation (non-blocking, logging only)
        const validation = validateFoodVision(result.data);
        if (!validation.isValid) {
            console.warn(`[AI:FoodVision] ⚠️ Validation issues: ${validation.issues.join(", ")}`);
        }

        console.log(
            `[AI:FoodVision] Recognized ${result.data.items.length} items | ` +
            `${result.data.meal_summary.total_calories_kcal} kcal total | ` +
            `reaction: ${result.data.reaction_type}`,
        );
    }

    return { data: result.data, errorMessage: result.errorMessage };
}
