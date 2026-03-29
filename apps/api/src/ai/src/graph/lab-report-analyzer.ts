/**
 * Lab Report Analyzer — GPT-5.2 premium diagnostics.
 *
 * Receives parsed biomarker results and produces a deep structured
 * diagnostic report using Chain-of-Thought clinical analysis.
 *
 * Pattern: follows vision-analyzer.ts architecture.
 */

import { callLlmStructured, LLM_RETRIES } from "../llm-client.js";
import {
    LabDiagnosticReportSchema,
    type LabDiagnosticReport,
} from "../ai-schemas.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ── Types ───────────────────────────────────────────────────────────

/** Biomarker result from Python parser (mirrors frontend BiomarkerResult). */
interface BiomarkerInput {
    readonly original_name: string;
    readonly standardized_slug: string;
    readonly value_numeric?: number | null;
    readonly value_string?: string | null;
    readonly unit?: string | null;
    readonly flag?: string | null;
}

// ── Constants ───────────────────────────────────────────────────────

/** Timeout for GPT-5.2 analysis (2 minutes — for stable medical analysis). */
const LAB_ANALYSIS_TIMEOUT_MS = 120_000;

/** Temperature for clinical precision. */
const LAB_ANALYSIS_TEMPERATURE = 0.2;

/** Model for premium diagnostics. */
const LAB_ANALYSIS_MODEL = "gpt-5.4-mini"; // Switched from router to official OpenAI 2026-03-29

// ── System Prompt ───────────────────────────────────────────────────

const LAB_DIAGNOSTIC_SYSTEM_PROMPT = `Ты — клинический аналитик уровня функциональной медицины.

## РОЛЬ
Ты получаешь результаты лабораторных анализов пациента. Твоя задача — провести ГЛУБОКИЙ системный анализ и составить подробный отчёт.

## МЕТОД АНАЛИЗА (Chain-of-Thought)

### Этап 1: Оценка каждого показателя
ВНИМАНИЕ (ПРИОРИТИЗАЦИЯ): Ты обязан включить в отчет ВСЕ предоставленные показатели. 
1. Если показатель ВНЕ нормы (Flag Low/High) -> расписывай клиническое значение максимально глубоко.
2. Если показатель В норме, но функционально связан с отклонениями (например, MCV при анемии) -> расписывай глубоко.
3. Если показатель В норме и не связан с проблемами -> обязательно укажи его в списке, но в поле clinical_significance пиши кратко: 'Показатель в норме'.

### Этап 2: Паттерн-анализ (САМЫЙ ВАЖНЫЙ)
Ищи СВЯЗКИ между показателями.
Особое внимание:
- Железодефицит: Анализируй не только Ферритин и Железо, но и ОБЯЗАТЕЛЬНО эритроцитарные индексы (Гемоглобин, MCV, MCH, Эритроциты), если они предоставлены. Низкий MCV/MCH подтверждает микроцитарную гипохромную анемию.
- Щитовидная железа: ТТГ↑ + Т4 св.↓ + Анти-ТПО↑↑ = аутоиммунный тиреоидит (Хашимото).
- Метаболизм: Холестерин↑ + Глюкоза↑ = преддиабет / метаболический синдром.
- Витамины: Витамин D↓ усугубляет аутоиммунные процессы и нарушает усвоение множества минералов. B12 + Фолат — проверяй на риск макроцитоза.
Каждый выявленный паттерн должен содержать название, список маркеров, патофизиологическое объяснение, степень серьёзности (severity) и конкретные шаги.

### Этап 3: Приоритизация
Ранжируй действия по срочности:
- URGENT: критические дефициты (ферритин <10, вит D <15), манифестная анемия (низкий гемоглобин), острый гипотиреоз.
- IMPORTANT: умеренные отклонения (холестерин, глюкоза), требующие изменения образа жизни или БАД.
- ROUTINE: контроль и профилактика.

### Этап 4: Дополнительные анализы
ВНИМАНИЕ (АНТИ-ГАЛЛЮЦИНАЦИЯ): НИКОГДА не рекомендуй сдавать анализы, которые УЖЕ присутствуют в предоставленных результатах (например, не рекомендуй "сдать Общий анализ крови", если Гемоглобин и MCV уже в списке).
Для каждого паттерна рекомендуй ТОЛЬКО глубокие диагностические шаги.
- Анемия: УЖЕ есть ОАК? Рекомендуй ОЖСС, трансферрин, В12, фолат, кал на скрытую кровь, ФГДС (поиск причины).
- Витамин D↓: Кальций ионизированный, паратгормон (ПТГ).
- Холестерин↑: Липидограмма (ЛПНП, ЛПВП, триглицериды), ApoB, индекс атерогенности, инсулин (HOMA-IR).
Объясняй ЗАЧЕМ нужен каждый тест.

### Этап 5: Диетарные рекомендации (ФУНКЦИОНАЛЬНЫЙ ПОДХОД)
Давай КОНКРЕТНЫЕ примеры продуктов, а не общие слова.
- Для железа: Красное мясо, печень, субпродукты (гемовое железо) ОБЯЗАТЕЛЬНО с кофакторами (Витамин С: болгарский перец, киви, цитрусовые). Избегать чая/кофе сразу после еды (танины блокируют усвоение).
- Для витамина D: Печень трески, жирная рыба. Обязательный приём добавок с жирной пищей (D3+K2).
- При Хашимото: Рассмотреть АИП (аутоиммунный протокол), безглютеновую диету, селен (бразильский орех).

### Этап 6: Персональные Зоны Продуктов (КРИТИЧЕСКИ ВАЖНО)

На основе ВСЕХ выявленных отклонений составь РАЗВЁРНУТЫЙ список веществ и продуктов, разделённый на три зоны:

#### 🔴 КРАСНАЯ ЗОНА (food_zones.red) — ПОЛНЫЙ ЗАПРЕТ
Вещества и продукты, которые НАПРЯМУЮ усугубляют выявленные патологии. Будь максимально конкретен:
- Указывай КОНКРЕТНЫЕ вещества (не просто "сахар", а "рафинированный сахар, фруктоза в количестве >25г, кукурузный сироп")
- Перечисляй КОНКРЕТНЫЕ продукты в found_in (не "сладости", а "шоколадные батончики, газированные напитки, пакетированные соки, мороженое, кондитерские изделия")
- Объясняй МЕХАНИЗМ вреда (не "вредно для печени", а "повышает нагрузку на гепатоциты, усугубляя текущий цитолиз при АЛТ=58")
- Предлагай АЛЬТЕРНАТИВЫ (чем заменить?)
- Правило конфликтов: если продукт одновременно полезен для одного маркера (Green) и вреден для другого (Red) — он идёт в RED с объяснением конфликта в поле conflicts.

**ВАЖНОЕ ПРАВИЛО (БЕЗОПАСНОСТЬ И ЭМПАТИЯ):**
- Если в \\\`userContext\\\` указано, что пациент НЕ употребляет алкоголь (\\\`alcohol_frequency: none\\\`) или НЕ курит (\\\`is_smoker: false\\\`), **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** давать советы в стиле "прекратите пить" или "бросайте курить".
- Для таких продуктов в Красной Зоне используй заголовок: **"ПОДТВЕРЖДЁННЫЙ ЗАПРЕТ (УЖЕ СОБЛЮДАЕТСЯ)"**.
- В поле \\\`mechanism\\\` похвали пациента за правильный выбор и объясни, почему при его текущих показателях (например, АЛТ или Мочевая кислота) возврат к этим привычкам был бы фатальным.

Типичные красные маркеры и их противопоказания:
| Отклонение                            | Запрещённые вещества                                                        |
| ------------------------------------- | --------------------------------------------------------------------------- |
| АЛТ/АСТ↑ (цитолиз печени)             | Этанол (алкоголь любой), трансжиры, фруктоза >25г/день                      |
| Мочевая кислота↑ (гиперурикемия)      | Пурины: красное мясо, субпродукты, сардины, анчоусы, пиво, крепкий алкоголь |
| Глюкоза↑ / Инсулинорезистентность     | Рафинированный сахар, белая мука, картофель фри, сладкие напитки            |
| Холестерин ЛПНП↑                      | Трансжиры, промышленная выпечка, маргарин, фастфуд                          |
| Антитела к тканевой трансглутаминазе↑ | Глютен: пшеница, рожь, ячмень, пиво, соевый соус                            |
| Креатинин↑ (дисфункция почек)         | Избыток белка >1.5г/кг, добавки креатина, НПВС                              |
| Калий↑ (гиперкалиемия)                | Бананы, картофель, шпинат, курага, томатная паста                           |
| Триглицериды↑↑                        | Алкоголь, рафинированные углеводы, фруктовые соки                           |

#### 🟡 ЖЁЛТАЯ ЗОНА (food_zones.yellow) — МОЖНО ЧУТЬ-ЧУТЬ
Продукты, от которых пациент может быть зависим или которые оказывают умеренный негативный эффект. Указывай ТОЧНЫЙ допустимый лимит в daily_limit:
- Кофеин при кортизоле↑: "Максимум 1 чашка до 12:00, без сахара"
- Молочные при СОЭ/СРБ↑: "До 100г кисломолочных в день (кефир, йогурт без сахара)"
- Соль при АД↑: "Максимум 5г в день, предпочтительно морская"

#### 🟢 ЗЕЛЁНАЯ ЗОНА (food_zones.green) — РЕКОМЕНДОВАНО
Продукты, которые ЗАКРЫВАЮТ конкретные дефициты. Указывай рекомендуемую дозировку в daily_limit:
- При ферритине↓: "Печень говяжья 100-150г 2-3 раза в неделю + витамин C"
- При витамине D↓: "Жирная рыба (лосось, скумбрия) 150г 3 раза в неделю"
- При магнии↓: "Тыквенные семечки 30г/день, тёмный шоколад >70% 20г/день"
- При фолате↓: "Шпинат, чечевица, спаржа ежедневно"

ВАЖНО: Стремись к МИНИМУМ 5 элементов в каждой зоне. Чем больше конкретики — тем лучше! Пустые зоны — это ПРОВАЛ. Даже при идеальных анализах в Green должна быть профилактика.

### Этап 7: Формирование Временных Баз Знаний (Knowledge Bases)
Для каждого значимого клинического паттерна (например, Анемия, Метаболический синдром, Гипотиреоз), сгенерируй "Временную Базу Знаний" (массив \\\`generated_knowledge_bases\\\`). 
Это подробная инструкция для ДРУГИХ ИИ-агентов системы о том, как "вести" этого пациента каждый день:
- Укажи кофакторы (что помогает лечению).
- Укажи ингибиторы (что мешает).
- Пропиши строгие правила образа жизни (например, "Не пить кофе за час до и после еды", "Следить за достаточным сном").

## ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА
1. Анализируй ВСЕ показатели из списка.
2. Не ставь 100% медицинские диагнозы — пиши "картина характерна для...", "данные указывают на риск...".
3. Данные согласуй с полом/возрастом.
4. Всегда завершай дисклеймером о необходимости консультации с врачом.
5. Текст отчёта должен быть чётким, ёмким, без воды, в стиле доказательного врача превентивной медицины.

## КОНТЕКСТ ПАЦИЕНТА
{userContext}
`;

// ── Fallback ────────────────────────────────────────────────────────

const LAB_DIAGNOSTIC_FALLBACK: LabDiagnosticReport = {
    summary: "Не удалось выполнить диагностический анализ в данный момент. Попробуйте позже.",
    biomarker_assessments: [],
    diagnostic_patterns: [],
    priority_actions: [],
    recommended_additional_tests: [],
    dietary_recommendations: [],
    food_zones: {
        red: [],
        yellow: [],
        green: [],
        conflicts: [],
        generated_from_date: new Date().toISOString(),
    },
    generated_knowledge_bases: [],
    supplement_protocol: {
        title: "Не требуется",
        protocol_rationale: "",
        items: [],
        warnings: [],
    },
    disclaimer: "⚠️ Данный отчёт является информационным и не заменяет консультацию врача.",
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Generates a SHA-256 hash from the biomarker results to prevent duplicate LLM calls.
 */
function generateBiomarkersHash(results: BiomarkerInput[]): string {
    const sorted = [...results].sort((a, b) => a.original_name.localeCompare(b.original_name));
    const dataString = JSON.stringify(
        sorted.map((r) => ({
            name: r.original_name,
            value: r.value_numeric ?? r.value_string,
            unit: r.unit
        }))
    );
    return crypto.createHash("sha256").update(dataString).digest("hex");
}

/**
 * Formats biomarker results into a human-readable string for the LLM.
 */
function formatBiomarkersForLLM(results: BiomarkerInput[]): string {
    const lines = results.map(
        (r) => {
            const val = r.value_numeric !== null && r.value_numeric !== undefined ? r.value_numeric : (r.value_string || "N/A");
            const unit = r.unit ? ` ${r.unit}` : "";
            const flag = r.flag ? ` (Flag: ${r.flag})` : "";
            return `- ${r.original_name}: ${val}${unit}${flag}`;
        }
    );
    return `Результаты лабораторных анализов:\n\n${lines.join("\n")}`;
}

// ── Core Function ───────────────────────────────────────────────────

export async function runLabReportAnalyzer(
    biomarkerResults: BiomarkerInput[],
    userContext: string,
    userId: string,
    token: string,
): Promise<LabDiagnosticReport> {
    const currentHash = generateBiomarkersHash(biomarkerResults);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    let supabase: ReturnType<typeof createClient> | null = null;
    let existingReports: any[] = [];

    // ── Check for duplicate report in DB ─────────────────────────────
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: profile } = await supabase
            .from("profiles")
            .select("lab_diagnostic_reports, food_contraindication_zones, active_supplement_protocol")
            .eq("id", userId)
            .single();

        if (profile) {
            existingReports = Array.isArray((profile as any).lab_diagnostic_reports)
                ? (profile as any).lab_diagnostic_reports
                : [];

            // Find existing report with the same hash
            const existingMatch = existingReports.find((r: any) => r.data_hash === currentHash);

            if (existingMatch && existingMatch.report) {
                console.log(`[LabAnalyzer] 🔄 Duplicate found (hash: ${currentHash}). Returning existing report.`);
                return existingMatch.report;
            }

            // --- Fetch current state for merging ---
            const zones = (profile as any).food_contraindication_zones || { red: [], yellow: [], green: [] };
            const leanZones = {
                red: zones.red?.map((z: any) => z.substance) || [],
                yellow: zones.yellow?.map((z: any) => z.substance) || [],
                green: zones.green?.map((z: any) => z.substance) || [],
            };

            const supps = (profile as any).active_supplement_protocol?.items;

            const stateContext = `
--- CURRENT_CONSTRAINTS (Existing state to MERGE with) ---
FOOD ZONES: ${JSON.stringify(leanZones)}
SUPPLEMENTS: ${JSON.stringify(supps ? supps : [])}
`;
            userContext += stateContext;
        }
    }

    // ── Run LLM Analysis ─────────────────────────────────────────────
    const result = await callLlmStructured({
        schema: LabDiagnosticReportSchema,
        schemaName: "lab_diagnostic_report",
        systemPrompt: LAB_DIAGNOSTIC_SYSTEM_PROMPT.replace("{userContext}", userContext),
        userMessage: formatBiomarkersForLLM(biomarkerResults),
        model: LAB_ANALYSIS_MODEL,
        temperature: LAB_ANALYSIS_TEMPERATURE,
        timeoutMs: LAB_ANALYSIS_TIMEOUT_MS,
        maxOutputTokens: 10000,
        maxRetries: LLM_RETRIES.async,
        fallback: LAB_DIAGNOSTIC_FALLBACK,
    });

    console.log(`[LabAnalyzer] Tokens used: ${result.usage?.totalTokens ?? "n/a"}`);

    if (result.source === "fallback") {
        console.warn("[AI:LabAnalyzer] Using fallback — LLM unavailable");
        return result.data;
    }

    // ── Persist report in profiles.lab_diagnostic_reports ────────────
    if (supabase) {
        existingReports.push({
            timestamp: new Date().toISOString(),
            biomarkers_count: biomarkerResults.length,
            data_hash: currentHash,
            report: result.data,
            biomarkers: biomarkerResults,
        });

        const { error: updateError } = await supabase
            .from("profiles")
            // @ts-ignore
            .update({ lab_diagnostic_reports: existingReports })
            .eq("id", userId);

        if (result.data.food_zones) {
            await supabase
                .from("profiles")
                // @ts-ignore
                .update({ food_contraindication_zones: result.data.food_zones })
                .eq("id", userId);
        }

        // ── Phase 49: Persist Temporary Knowledge Bases ────────────
        if (result.data.generated_knowledge_bases && result.data.generated_knowledge_bases.length > 0) {
            for (const kb of result.data.generated_knowledge_bases) {
                // Check if an active knowledge base with this condition name already exists
                const { data: existingKb } = await supabase
                    .from("active_condition_knowledge_bases")
                    .select("id")
                    .eq("profile_id", userId)
                    .eq("condition_name", kb.condition_name)
                    .eq("is_active", true)
                    .single();

                if (!existingKb) {
                    await supabase
                        .from("active_condition_knowledge_bases")
                        // @ts-ignore
                        .insert({
                            profile_id: userId,
                            condition_name: kb.condition_name,
                            knowledge_data: kb as any,
                        });
                } else {
                    // Update the existing one with fresh knowledge
                    await supabase
                        .from("active_condition_knowledge_bases")
                        // @ts-ignore
                        .update({ knowledge_data: kb as any })
                        .eq("id", (existingKb as any).id);
                }
            }
        }

        // ── Phase 50: Persist Supplement Protocol ────────────
        if (result.data.supplement_protocol && result.data.supplement_protocol.items && result.data.supplement_protocol.items.length > 0) {
            await supabase
                .from("profiles")
                // @ts-ignore
                .update({ active_supplement_protocol: result.data.supplement_protocol })
                .eq("id", userId);
        }

        if (updateError) {
            console.error("[LabAnalyzer] Failed to save report:", updateError);
        } else {
            console.log(
                `[LabAnalyzer] ✅ Saved report for user ${userId}. ` +
                `Biomarkers: ${biomarkerResults.length}, ` +
                `Tokens: ${result.usage?.totalTokens ?? "n/a"}, ` +
                `Latency: ${result.latencyMs}ms`,
            );
        }
    }

    return result.data;
}
