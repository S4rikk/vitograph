/**
 * AI Output Schemas — Zod schemas for LLM structured outputs.
 *
 * These schemas are passed to `generateObject()` (Vercel AI SDK)
 * which converts them to JSON Schema for OpenAI Structured Outputs.
 * The LLM response is validated against these schemas at runtime.
 *
 * Three output domains:
 * 1. PsychologicalOutput — CBT-framed chat reply (sync)
 * 2. CorrelationOutput  — food-symptom pattern analysis (async)
 * 3. DiagnosticOutput   — hypotheses + lab test recommendations (async)
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════
// §1  Psychological Response (Sync)
// ═══════════════════════════════════════════════════════════════════════

/** CBT strategies available for the psychological engine. */
export const CbtStrategyEnum = z.enum([
  "encouragement",
  "gentle_redirect",
  "cbt_reframe",
  "neutral_acknowledgment",
  "celebration",
]);

/** Zod schema for the CBT-framed psychological chat response. */
export const PsychologicalOutputSchema = z.object({
  /** Chat message text (2-3 sentences, in Russian). */
  message: z
    .string()
    .describe("Chat message for the user, 2-3 sentences, in Russian"),

  /** CBT strategy used to frame the response. */
  strategy: CbtStrategyEnum.describe("CBT framing strategy applied"),

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

/** Single diagnostic hypothesis with a reasoning chain. */
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

// ── Somatic Diagnostics (Vision AI) ────────────────────────────────────

export const SomaticDiagnosticsOutputSchema = z.object({
  markers: z.array(z.string()).describe("List of visual markers found on the body part (e.g., 'Leukonychia', 'White coating', 'Acne')"),
  interpretation: z.string().describe("Human-readable interpretation of the markers and potential deficits, phrased as a supportive, advisory friend."),
  confidence: z.number().min(0).max(1).describe("Confidence in the visual analysis"),
});

export type SomaticDiagnosticsOutput = z.infer<typeof SomaticDiagnosticsOutputSchema>;

// ── Food Recognition (Vision AI) ────────────────────────────────────

/** Nutritional values per 100g of a single food item. */
const NutrientsPer100gSchema = z.object({
  calories_kcal: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  carbs_g: z.number(),
  fiber_g: z.number(),

  // Vitamins (must be numbers to force LLM generation, fallback to 0)
  vitamin_a_mcg: z.number().describe("Если неизвестно, пиши 0"),
  vitamin_c_mg: z.number().describe("Если неизвестно, пиши 0"),
  vitamin_d_mcg: z.number().describe("Если неизвестно, пиши 0"),
  vitamin_e_mg: z.number().describe("Если неизвестно, пиши 0"),
  vitamin_b12_mcg: z.number().describe("Если неизвестно, пиши 0"),
  folate_mcg: z.number().describe("Если неизвестно, пиши 0"),

  // Microelements
  iron_mg: z.number().describe("Если неизвестно, пиши 0"),
  calcium_mg: z.number().describe("Если неизвестно, пиши 0"),
  magnesium_mg: z.number().describe("Если неизвестно, пиши 0"),
  zinc_mg: z.number().describe("Если неизвестно, пиши 0"),
  selenium_mcg: z.number().describe("Если неизвестно, пиши 0"),
  potassium_mg: z.number().describe("Если неизвестно, пиши 0"),
  sodium_mg: z.number().describe("Если неизвестно, пиши 0"),
});

/** Macro totals for a single food item based on estimated weight. */
const EstimatedTotalSchema = z.object({
  calories_kcal: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  carbs_g: z.number(),
});

/** A single recognized food item from the photo. */
const FoodItemSchema = z.object({
  name_ru: z.string().describe("Название блюда/продукта на русском"),
  name_en: z.string().describe("English name for logging"),
  estimated_weight_g: z
    .number()
    .describe("Предполагаемый вес в граммах (визуальная оценка)"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Уверенность распознавания 0-1"),
  per_100g: NutrientsPer100gSchema,
  estimated_total: EstimatedTotalSchema,
});

/** An active ingredient in a supplement. */
const SupplementIngredientSchema = z.object({
  ingredient_name: z.string().describe("Название активного вещества (например, 'Ресвератрол', 'Витамин D3')"),
  amount: z.number().describe("Количество на употребленную порцию"),
  unit: z.string().describe("Единица измерения (мг, мкг, МЕ, г и т.д.)")
});

/** A single supplement or vitamin recognized from the photo. */
const FoodSupplementItemSchema = z.object({
  name_ru: z.string().describe("Название добавки (например, 'Экстракт красного вина', 'Омега-3')"),
  serving_size_taken: z.number().describe("Сколько порций/штук употреблено (по умолчанию 1 порция)"),
  active_ingredients: z.array(SupplementIngredientSchema).describe("Список активных веществ из Supplement Facts на употребленную порцию.")
});

export const FoodRecognitionOutputSchema = z.object({
  items: z.array(FoodItemSchema).describe("Распознанные продукты/блюда"),
  supplements: z.array(FoodSupplementItemSchema).describe("Распознанные витамины и БАДы (если нет на фото, верни пустой массив)"),
  meal_summary: z.object({
    total_calories_kcal: z.number(),
    total_protein_g: z.number(),
    total_fat_g: z.number(),
    total_carbs_g: z.number(),
  }),
  meal_quality_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Оценка полезности еды от 0 до 100."),
  meal_quality_reason: z
    .string()
    .max(150)
    .describe("Короткое объяснение оценки (1-2 предложения, почему такая цифра)."),
  health_reaction: z
    .string()
    .describe(
      "Персонализированная реакция ИИ на русском: как эта еда влияет на дефициты, цели, запреты",
    ),
  reaction_type: z.enum([
    "positive",
    "neutral",
    "warning",
    "restriction_violation",
  ]),
});

export type FoodRecognitionOutput = z.infer<typeof FoodRecognitionOutputSchema>;

// ── Food Label & Ingredients Recognition (Vision AI) ────────────────

export const LabelScannerOutputSchema = z.object({
  product_name: z.string().describe("Название продукта"),
  verdict: z.enum(["GREEN", "YELLOW", "RED"]).describe("Вердикт по полезности и безопасности для данного пользователя: GREEN (разрешено/полезно), YELLOW (ограничить), RED (запрещено/вредно)"),
  verdict_reason: z.string().describe("Краткое, четкое, конкретное пояснение полезности данного продукта для ЭТОГО пользователя с учетом профиля здоровья"),
  e_codes: z.array(z.object({
    code: z.string().describe("E-код добавки, например 'E211'"),
    name: z.string().describe("Название добавки, например 'Бензоат натрия'"),
    danger_level: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("Уровень опасности добавки"),
    description: z.string().describe("Краткое описание влияния на здоровье")
  })).describe("Найденные E-добавки в составе (если нет - верни пустой массив)"),
  macronutrients_per_100g: z.object({
    calories: z.number().nullable().describe("Если неизвестно, верни null"),
    protein: z.number().nullable().describe("Если неизвестно, верни null"),
    fat: z.number().nullable().describe("Если неизвестно, верни null"),
    carbs: z.number().nullable().describe("Если неизвестно, верни null")
  }).nullable().describe("Указанные на этикетке макросы на 100г, если видно, иначе null")
});

export type LabelScannerOutput = z.infer<typeof LabelScannerOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════
// §6  Lab Diagnostic Report (GPT-5.2 Premium Analysis)
// ═══════════════════════════════════════════════════════════════════════

// ── Food Contraindication Zones ──────────────────────────────────────

/** Единичная запись о веществе/продукте в зоне противопоказаний. */
const FoodZoneItemSchema = z.object({
  /** Конкретное вещество или категория продуктов. */
  substance: z.string().describe("Конкретное вещество или продукт (например: 'Рафинированный сахар', 'Глютен', 'Красное мясо', 'Трансжиры', 'Этанол')"),

  /** Продукты, в которых это вещество содержится (конкретные примеры). */
  found_in: z.array(z.string()).describe("Конкретные продукты-источники (например: ['Белый хлеб', 'Паста', 'Пиво', 'Соус соевый'] для глютена)"),

  /** Почему именно это вещество под запретом/ограничением/рекомендовано. */
  reason: z.string().describe("Подробное клиническое обоснование со ссылкой на конкретный биомаркер и его значение"),

  /** Какой биомаркер инициировал это правило. */
  biomarker_trigger: z.string().describe("Название показателя, который стал причиной (например: 'Мочевая кислота: 8.5 мг/дл')"),

  /** Допустимый лимит для Yellow-зоны, или рекомендуемая дозировка для Green. Null для Red. */
  daily_limit: z.string().nullable().describe("Допустимый лимит потребления (например: 'не более 25г сахара в день', 'минимум 150г красного мяса 3 раза в неделю'). Null если полный запрет."),

  /** Безопасные альтернативы (только для Red и Yellow зон). */
  alternatives: z.array(z.string()).describe("Безопасные замены (например: ['Стевия', 'Эритритол'] вместо сахара). Пустой массив для Green зоны."),
});

/** Полный блок зон противопоказаний. */
const FoodContraindicationZonesSchema = z.object({
  /** 🔴 СТРОЖАЙШИЙ ЗАПРЕТ. Продукты/вещества, которые НАПРЯМУЮ усугубляют выявленные патологии. */
  red: z.array(FoodZoneItemSchema).describe(
    "КРАСНАЯ ЗОНА — полный запрет. Вещества, которые напрямую ухудшают выявленные отклонения. " +
    "Примеры: алкоголь при повышенных АЛТ/АСТ, пурины (красное мясо, субпродукты) при мочевой кислоте↑↑, " +
    "глютен при антителах к тканевой трансглутаминазе, рафинированный сахар при инсулинорезистентности."
  ),

  /** 🟡 ОГРАНИЧЕННОЕ ПОТРЕБЛЕНИЕ. Продукты, от которых сложно отказаться, но их можно совсем немного. */
  yellow: z.array(FoodZoneItemSchema).describe(
    "ЖЁЛТАЯ ЗОНА — можно чуть-чуть, чтобы погасить тягу. Умеренный вред или продукты-зависимости. " +
    "Примеры: кофеин при повышенном кортизоле (макс 1 чашка утром), молочные при субклиническом воспалении, " +
    "соль при повышенном давлении (макс 5г/день)."
  ),

  /** 🟢 РЕКОМЕНДОВАНО. Продукты, которые ЗАКРЫВАЮТ конкретные дефициты. */
  green: z.array(FoodZoneItemSchema).describe(
    "ЗЕЛЁНАЯ ЗОНА — рекомендуемые продукты. Закрывают конкретные дефициты выявленные в анализах. " +
    "Примеры: печень/красное мясо при ферритине↓, жирная рыба при витамине D↓, " +
    "бразильский орех (селен) при Хашимото, шпинат/чечевица при фолате↓."
  ),

  /** Правило конфликтов: если продукт одновременно в Red и Green, объяснение. */
  conflicts: z.array(z.object({
    substance: z.string(),
    red_reason: z.string(),
    green_reason: z.string(),
    resolution: z.string().describe("Итоговое решение: в какую зону попал и почему (Red ВСЕГДА побеждает Green)"),
  })).describe("Конфликты между зонами. Например: красное мясо полезно для ферритина↓, но запрещено при мочевой кислоте↑↑. Red > Yellow > Green."),

  /** Timestamp — когда зоны были сгенерированы. */
  generated_from_date: z.string().describe("Дата анализов, на основе которых построены зоны (ISO формат)"),
});

/** Assessment of a single biomarker from lab results. */
const BiomarkerAssessmentSchema = z.object({
  name: z.string().describe("Название показателя"),
  value: z.number(),
  unit: z.string(),
  reference_range: z.string().describe("Референсный диапазон"),
  status: z.enum(["critical_low", "low", "normal", "high", "critical_high"]),
  clinical_significance: z
    .string()
    .describe("Клиническое значение отклонения, подробно"),
});

/** A clinical pattern / syndrome detected across multiple biomarkers. */
const DiagnosticPatternSchema = z.object({
  pattern_name: z
    .string()
    .describe("Название клинического паттерна / синдрома"),
  involved_markers: z
    .array(z.string())
    .describe("Какие показатели участвуют в паттерне"),
  explanation: z
    .string()
    .describe("Подробное объяснение механизма"),
  severity: z.enum(["mild", "moderate", "significant"]),
  recommendations: z
    .array(z.string())
    .describe("Конкретные рекомендации: анализы, питание, образ жизни"),
});

/** Temporary Knowledge Base for a detected pattern/syndrome (Phase 49) */
export const KnowledgeBaseSchema = z.object({
  condition_name: z.string().describe("Название паттерна/болезни (например, Латентная Анемия)"),
  pathophysiology_simple: z.string().describe("Простое объяснение механизма (для ответа юзеру в чате)"),

  // Ключевое для AI при оценке еды:
  cofactors: z.array(z.string()).describe("Кофакторы. Что нужно для усвоения/улучшения (например: 'Вит С', 'Вит B12')"),
  inhibitors: z.array(z.string()).describe("Ингибиторы. Что блокирует усвоение/ухудшает (например: 'Фитаты', 'Танины', 'Кофеин')"),

  lifestyle_rules: z.array(z.string()).describe("Правила образа жизни (например: 'Разносить чай и мясо на 2 часа')"),
  symptoms_to_track: z.array(z.string()).describe("Симптомы, за которыми нужно следить (например: 'Головокружение', 'Бледность')"),
});

// -----------------------------------------------------------------------------
// Phase 50: Supplement Protocols
// -----------------------------------------------------------------------------

export const SupplementItemSchema = z.object({
  name_en: z.string().describe("Название ингредиента/добавки (e.g. Magnesium Bisglycinate)"),
  name_ru: z.string().describe("Оптимальная биодоступная форма (Хелат, Бисглицинат, Метилкобаламин и т.д.)"),
  dosage: z.string().describe("Точная терапевтическая дозировка (например '400 мг', '1000 МЕ')"),
  timing: z.enum(["morning_fasted", "morning_with_food", "afternoon", "evening", "before_bed"]).describe("Оптимальное время приема"),
  food_relation: z.enum(["empty_stomach", "with_water", "with_fatty_food", "with_general_food"]).describe("Связь с едой"),
  duration_weeks: z.number().describe("Продолжительность курса в неделях"),
  rationale: z.string().describe("Почему выбрана именно эта форма и дозировка? (привязка к анализам)"),
  antagonists: z.array(z.string()).describe("С чем КРИТИЧЕСКИ НЕЛЬЗЯ принимать вместе? (например, 'Цинк', 'Кальций')"),
});

export const SupplementProtocolSchema = z.object({
  title: z.string().describe("Короткое название протокола (например, 'Протокол восполнения Железа и кофакторов')"),
  protocol_rationale: z.string().describe("Краткое объяснение логики всего протокола"),
  items: z.array(SupplementItemSchema).describe("Список конкретных добавок"),
  warnings: z.array(z.string()).describe("Общие предупреждения по протоколу (например, 'Не пить чай сразу после приема железа')"),
});

// -----------------------------------------------------------------------------
// Core Lab Report Output Schema
// -----------------------------------------------------------------------------
export const LabDiagnosticReportSchema = z.object({
  /** Section 1: Brief health summary (3-4 sentences). */
  summary: z
    .string()
    .describe("Краткое резюме состояния здоровья на 3-4 предложения"),

  /** Section 2: Individual biomarker assessments. */
  biomarker_assessments: z.array(BiomarkerAssessmentSchema),

  /** Section 3: Detected clinical patterns / syndromes. */
  diagnostic_patterns: z.array(DiagnosticPatternSchema),

  /** Section 4: Prioritized action items. */
  priority_actions: z.array(z.object({
    priority: z.enum(["urgent", "important", "routine"]),
    action: z.string(),
    reasoning: z.string(),
  })),

  /** Section 5: Additional tests to consider. */
  recommended_additional_tests: z.array(z.object({
    test_name: z.string(),
    reason: z.string(),
  })),

  /** Section 6: Dietary recommendations linked to markers. */
  dietary_recommendations: z.array(z.object({
    recommendation: z.string(),
    target_markers: z
      .array(z.string())
      .describe("Какие показатели это улучшит"),
  })),

  /** Section 7: Персональные зоны продуктов (Red/Yellow/Green). */
  food_zones: FoodContraindicationZonesSchema.describe(
    "Персональные зоны продуктов на основе выявленных отклонений в анализах"
  ),

  /** Section 8: Временные Базы Знаний для выявленных синдромов */
  generated_knowledge_bases: z
    .array(KnowledgeBaseSchema)
    .describe(
      "Сгенерируй глубокую базу знаний для каждого серьезного выявленного паттерна (анемия, инсулинорезистентность и т.д.). " +
      "Эти данные будут использоваться AI ежедневно для контроля пользователя, пока диагноз не будет снят. " +
      "Если серьёзных паттернов нет — верни пустой массив [].",
    ),

  /** Section 9: Сгенерированный персональный протокол БАДов (Phase 50) */
  supplement_protocol: SupplementProtocolSchema.describe(
    "Глубоко проработанный протокол добавок, закрывающий дефициты, выявленные в анализах. " +
    "Учитывай биодоступные формы и антагонистов. " +
    "Если дефицитов нет и протокол не нужен — верни объект с title='Не требуется', пустыми items и warnings.",
  ),

  /** Medical disclaimer (always present). */
  disclaimer: z.string(),
});

export type LabDiagnosticReport = z.infer<typeof LabDiagnosticReportSchema>;
