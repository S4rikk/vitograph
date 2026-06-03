import { z } from "zod";
import { callLlmStructured, LLM_TIMEOUTS, LLM_RETRIES, getConfigLlmModel } from "../llm-client.js";

const DynamicWearableSchema = z.object({
  detectedCategory: z.enum(["sleep", "cardio", "body", "metabolic", "stress", "unknown"]),
  extractedMetrics: z.array(z.object({
    originalName: z.string().describe("Оригинальное название метрики со скриншота (напр. 'Body Battery')"),
    standardizedCategory: z.string().describe("Унифицированный ключ (snake_case) (напр. 'recovery_reserve', 'hrv')"),
    semanticMeaning: z.string().describe("Краткий медицинский/фитнес смысл метрики для контекста агента"),
    rawValue: z.string().describe("Точное значение со скриншота строкой (напр. '7h 30m', '120/80', '85')"),
    numericValue: z.number().nullable().describe("Нормализованное десятичное число для графиков (напр. '7h 30m' -> 7.5, '120/80' -> null)"),
    unit: z.string().describe("Единицы измерения (bpm, %, мс и т.д.)"),
    confidence: z.number().describe("Уверенность распознавания от 0 до 1")
  }))
});

export async function runWearableVisionAnalyzer(imageBase64: string) {
  // ФИКС ФОРМАТА VERCEL AI SDK: используем type: "image" и new URL()
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Please extract the health and wearable metrics visible in this screenshot." },
        { type: "image", image: new URL(imageBase64) }
      ]
    }
  ];

  // Динамическое получение модели из админки
  const model = await getConfigLlmModel("analysis_llm", "gpt-5.4-mini");

  const result = await callLlmStructured({
    schema: DynamicWearableSchema,
    schemaName: "wearable_metrics",
    systemPrompt: "You are an expert medical data extractor. Analyze the provided screenshot from a fitness tracker/health app. First, determine which category the screenshot belongs to (sleep, cardio, body, metabolic, or stress). If it's not a health screenshot, return 'unknown'. Then, extract all visible health metrics into the `extractedMetrics` array. IMPORTANT: STRICTLY IGNORE system UI elements such as phone battery, time on the clock, carrier/WiFi signal, or navigation bars.",
    messages,
    timeoutMs: 60000, // Увеличили таймаут для Vision + Auto-Detect
    maxRetries: LLM_RETRIES.sync,
    model: model,
    fallback: { detectedCategory: "unknown", extractedMetrics: [] },
    temperature: 0.1,
  });

  return result.data;
}
