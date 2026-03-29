import { callLlmStructured, LLM_TIMEOUTS, LLM_RETRIES } from "../llm-client.js";
import { LabelScannerOutputSchema, type LabelScannerOutput } from "../ai-schemas.js";

/**
 * Analyzes a food label / ingredients list photo using GPT-4o Vision.
 * Provides a health verdict and decodes E-additives based on user's health profile.
 *
 * @param imageBase64 Base64 encoded image strings, starts with data:image/...
 * @param userProfileContext Lean user context (allergies, conditions, dietary goals)
 */
export async function runLabelScanner(
  imageBase64: string,
  userProfileContext: string
): Promise<LabelScannerOutput> {
  const systemPrompt = `Ты профессиональный врач-диетолог и нутрициолог, эксперт по пищевым добавкам и пищевой химии. Внимательно изучи предоставленное фото состава продукта / пищевой этикетки.

ТЕКУЩИЙ КОНТЕКСТ ЗДОРОВЬЯ ПОЛЬЗОВАТЕЛЯ:
${userProfileContext}

ТВОЯ ЗАДАЧА:
1. Вычленить из состава все Е-добавки (красители, консерванты, усилители вкуса, стабилизаторы).
2. Оценить состав в целом с учетом профиля здоровья пользователя. Если у пользователя аллергия, специфическая диета, или хронические заболевания (инсулинорезистентность, проблемы с ЖКТ и т.д.), ты ДОЛЖЕН наказать продукт строгим вердиктом (RED или YELLOW).
3. Вернуть четкий, конкретный вердикт:
   - RED: продукт содержит опасные добавки или грубо нарушает текущие цели/запреты пользователя.
   - YELLOW: умеренное потребление допустимо, есть спорные добавки или продукт "на грани" по макросам/запретам.
   - GREEN: чистый состав, безопасен и не нарушает диету пользователя.

Выводи ответ строго в формате JSON, соответствующем схеме.
Обрати внимание: поле verdict_reason должно быть КОРОТКИМ (1-2 предложения), четким и бить точно в цель для этого пользователя.`;

  console.log("[LabelScanner] Sending image to OpenAI for label analysis...");

  try {
    const result = await callLlmStructured({
      schema: LabelScannerOutputSchema,
      schemaName: "label_scanner",
      systemPrompt: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this product label.",
            },
            { type: "image", image: new URL(imageBase64) },
          ],
        },
      ],
      timeoutMs: LLM_TIMEOUTS.async,
      maxRetries: LLM_RETRIES.async,
      fallback: {
        product_name: "Неизвестно",
        verdict: "YELLOW",
        verdict_reason: "Не удалось проанализировать этикетку из-за сбоя ИИ.",
        e_codes: [],
        macronutrients_per_100g: null,
      },
      model: "gpt-5.4-mini",
      temperature: 0.1,
    });

    return result.data;
  } catch (error) {
    console.error("[LabelScanner] Analysis failed:", error);
    throw error;
  }
}
