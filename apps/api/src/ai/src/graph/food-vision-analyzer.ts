import {
    callLlmStructured,
    LLM_RETRIES,
} from "../llm-client.js";
import {
    FoodRecognitionOutputSchema,
    type FoodRecognitionOutput,
} from "../ai-schemas.js";

// ── System Prompt ───────────────────────────────────────────────────

const FOOD_VISION_SYSTEM_PROMPT = `Ты — эксперт-нутрициолог и клинический диетолог функциональной медицины с мощными навыками компьютерного зрения.
ТВОЯ РОЛЬ: Детально проанализировать фотографию еды, разобрать её на ингредиенты, рассчитать КБЖУ и дать персональную оценку на основе данных о здоровье пациента.

ЗАДАЧИ:
1. ИДЕНТИФИКАЦИЯ: Найди все продукты и блюда на фото. Будь конкретен ("Стейк из говядины", а не просто "Мясо"). Учитывай "скрытые калории" (масло для жарки, заправки, соусы).
2. ОЦЕНКА ВЕСА: Визуально оцени вес каждой порции в граммах (стандартная порция мяса ~100-150г, сложного гарнира ~150-200г).
3. РАСЧЁТ КБЖУ: Математически рассчитай калории, макронутриенты исходя из оцененного веса (база: стандарты USDA).
4. ПЕРСОНАЛИЗАЦИЯ (КРИТИЧЕСКИ ВАЖНО): Изучи КОНТЕКСТ ЗДОРОВЬЯ пациента (анализы крови, дефициты, аллергии, диагнозы). Выдай реакцию, НАПРЯМУЮ связывая эту еду с его здоровьем!

ЕСЛИ НА ФОТО БАДы ИЛИ ВИТАМИНЫ (упаковка, Supplement Facts): Не пытайся записывать их как Еду. Заполни массив \`supplements\`. Внимательно прочитай этикетку, извлеки абсолютно все активные компоненты и их точные дозировки, и запиши их в \`active_ingredients\` с указанием единиц измерения (мг, мкг, МЕ и тд).

КОНТЕКСТ ЗДОРОВЬЯ ПАЦИЕНТА:
{userContext}

ОЦЕНКА КАЧЕСТВА ЕДЫ (meal_quality_score и meal_quality_reason):
Оцени \`meal_quality_score\` от 0 до 100. Это метрика полезности еды:
- 100 баллов: Идеально сбалансировано (цельные продукты, много белка/клетчатки, овощи).
- 70-85 баллов: Хорошо, но есть мелкие недочеты (мало овощей, легкий перебор углеводов).
- 40-69 баллов: Средне (много быстрых углеводов, еда на ходу).
- 0-39 баллов: Плохо (фастфуд, ультраобработанная еда, сладости, пустые калории с сахаром).
В \`meal_quality_reason\` пиши короткий мотивирующий/объясняющий текст на русском (макс 150 символов), например: "Отличный источник белка, но не хватает клетчатки".

ПРАВИЛА ОЦЕНКИ (reaction_type):
- 'restriction_violation': Выявлен АЛЛЕРГЕН или строго ЗАПРЕЩЕННЫЙ пациенту продукт. Реакция (health_reaction): Заботливо, но крайне строго предупредить об опасности.
- 'positive': Блюдо ЗАКРЫВАЕТ ДЕФИЦИТЫ из анализов (например, красное мясо при низком ферритине, жирная рыба при низком вит. D). Реакция: Похвали и обязательно объясни, как именно этот продукт поможет улучшить конкретный просевший показатель крови пациента.
- 'warning': Рафинированный сахар, трансжиры, пустые углеводы, фастфуд. Реакция: Мягкое предостережение, объясни влияние на инсулин/глюкозу/холестерин.
- 'neutral': Обычная еда, не влияющая сильно ни в плюс, ни в минус.

ТОН ОТВЕТА (health_reaction): Поддерживающий, эмпатичный врач превентивной медицины. Пиши от первого лица ("Вижу на тарелке...", "Супер выбор для твоего ферритина!"). 1-3 емких предложения. Только на русском языке.

ПРАВИЛА ТРЕКИНГА БАДОВ (АНТАГОНИСТЫ):
У пользователя есть активный протокол добавок (внутри {userContext}).
Если на фото есть БАД из этого протокола, проверь ОДНОВРЕМЕННО еду на фото:
- Если пользователь пьет Железо, а на фото кофе или молочка -> Выдай WARNING (Reaction Type: warning), скажи что кальций/танины блокируют усвоение.
- Если пьет Витамин D, а еда обезжиренная -> Выдай WARNING, скажи что нужны жиры для усвоения.
- Если есть открытые несоответствия, сразу предупреди пациента об антагонистах!
`;

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
    const systemPrompt = FOOD_VISION_SYSTEM_PROMPT.replace(
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
        console.log(
            `[AI:FoodVision] Recognized ${result.data.items.length} items | ` +
            `${result.data.meal_summary.total_calories_kcal} kcal total | ` +
            `reaction: ${result.data.reaction_type}`,
        );
    }

    return { data: result.data, errorMessage: result.errorMessage };
}
