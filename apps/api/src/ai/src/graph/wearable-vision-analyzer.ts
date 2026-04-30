import { z } from "zod";
import { callLlmStructured, LLM_TIMEOUTS, LLM_RETRIES, getConfigLlmModel } from "../llm-client.js";

const UnifiedWearableSchema = z.object({
  detectedCategory: z.enum(["sleep", "cardio", "body", "metabolic", "stress", "unknown"]),
  metrics: z.object({
    // Sleep
    sleepDurationHours: z.number().nullable(),
    deepSleepPercent: z.number().nullable(),
    remSleepPercent: z.number().nullable(),
    readinessScore: z.number().nullable(),
    hrvMs: z.number().nullable(),
    respiratoryRateBrpm: z.number().nullable(),
    // Cardio
    restingHeartRateBpm: z.number().nullable(),
    vo2MaxMlKgMin: z.number().nullable(),
    steps: z.number().nullable(),
    activeCaloriesKcal: z.number().nullable(),
    bloodPressureSystolic: z.number().nullable(),
    bloodPressureDiastolic: z.number().nullable(),
    // Body
    weightKg: z.number().nullable(),
    bodyFatPercent: z.number().nullable(),
    muscleMassPercent: z.number().nullable(),
    bmrKcal: z.number().nullable(),
    visceralFatIndex: z.number().nullable(),
    // Metabolic
    glucoseMmol: z.number().nullable(),
    timeInRangePercent: z.number().nullable(),
    glucoseVariabilityPercent: z.number().nullable(),
    // Stress
    stressScore: z.number().nullable(),
    bodyTemperatureVariationC: z.number().nullable(),
    spo2Percent: z.number().nullable(),
  })
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
    schema: UnifiedWearableSchema,
    schemaName: "wearable_metrics",
    systemPrompt: "You are an expert medical data extractor. Analyze the provided screenshot from a fitness tracker/health app. First, determine which category the screenshot belongs to (sleep, cardio, body, metabolic, or stress). If it's not a health screenshot, return 'unknown'. Then, extract all visible numeric metrics for that category into the `metrics` object. IMPORTANT: All values MUST be pure numbers. Do NOT include units.",
    messages,
    timeoutMs: 60000, // Увеличили таймаут для Vision + Auto-Detect
    maxRetries: LLM_RETRIES.sync,
    model: model,
    fallback: { detectedCategory: "unknown", metrics: {} },
    temperature: 0.1,
  });

  return result.data;
}
