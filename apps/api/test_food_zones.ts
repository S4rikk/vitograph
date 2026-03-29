import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env from the current directory
dotenv.config();

// ── Schema from Phase 48 Prompt ─────────────────────────────────────

const FoodZoneItemSchema = z.object({
    substance: z.string(),
    found_in: z.array(z.string()),
    reason: z.string(),
    biomarker_trigger: z.string(),
    daily_limit: z.string().nullable(),
    alternatives: z.array(z.string()),
});

const FoodContraindicationZonesSchema = z.object({
    red: z.array(FoodZoneItemSchema),
    yellow: z.array(FoodZoneItemSchema),
    green: z.array(FoodZoneItemSchema),
    conflicts: z.array(z.object({
        substance: z.string(),
        red_reason: z.string(),
        green_reason: z.string(),
        resolution: z.string()
    })),
    generated_from_date: z.string(),
});

const LabDiagnosticReportSchema = z.object({
    summary: z.string(),
    food_zones: FoodContraindicationZonesSchema,
    disclaimer: z.string(),
});

// ── Prompt from Phase 48 ────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — клинический аналитик уровня функциональной медицины.

Твоя задача — провести анализ лабораторных анализов и составить отчёт. Основной фокус в этом тесте — генерация зон продуктов.

### Этап 6: Персональные Зоны Продуктов (КРИТИЧЕСКИ ВАЖНО)

На основе ВСЕХ выявленных отклонений составь РАЗВЁРНУТЫЙ список веществ и продуктов, разделённый на три зоны:

#### 🔴 КРАСНАЯ ЗОНА (food_zones.red) — ПОЛНЫЙ ЗАПРЕТ
Вещества и продукты, которые НАПРЯМУЮ усугубляют выявленные патологии. Будь максимально конкретен:
- Указывай КОНКРЕТНЫЕ вещества (не просто "сахар", а "рафинированный сахар, фруктоза в количестве >25г, кукурузный сироп")
- Перечисляй КОНКРЕТНЫЕ продукты в found_in (не "сладости", а "шоколадные батончики, газированные напитки")
- Объясняй МЕХАНИЗМ вреда
- Предлагай АЛЬТЕРНАТИВЫ (чем заменить?)
- Правило конфликтов: если продукт одновременно полезен для одного маркера (Green) и вреден для другого (Red) — он идёт в RED с объяснением конфликта.

#### 🟡 ЖЁЛТАЯ ЗОНА (food_zones.yellow) — МОЖНО ЧУТЬ-ЧУТЬ
Продукты, от которых пациент может быть зависим или которые оказывают умеренный негативный эффект. Указывай ТОЧНЫЙ допустимый лимит в daily_limit.

#### 🟢 ЗЕЛЁНАЯ ЗОНА (food_zones.green) — РЕКОМЕНДОВАНО
Продукты, которые ЗАКРЫВАЮТ конкретные дефициты. Указывай рекомендуемую дозировку в daily_limit.

ВАЖНО: Постарайся найти минимум 3-5 элементов в каждой зоне, основываясь на данных.

КОНТЕКСТ: Женщина, 28 лет.
`;

async function runTest() {
    const filePath = "C:\\project\\kOSI\\vitograph-norm-tester\\test_report_anemia.txt";
    console.log(`Reading: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    console.log("Calling OpenAI GPT-4o...");
    try {
        const { object } = await generateObject({
            model: openai('gpt-5.4-mini'),
            schema: LabDiagnosticReportSchema,
            schemaName: "lab_diagnostic_report",
            system: SYSTEM_PROMPT,
            prompt: `Результаты лабораторных анализов:\n\n${fileContent}`,
            temperature: 0.2, // low temp for clinical stability
        });

        console.log("\n=== 🎯 ТЕСТ УСПЕШЕН! РЕЗУЛЬТАТ: ===\n");
        console.log(JSON.stringify(object.food_zones, null, 2));

    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
