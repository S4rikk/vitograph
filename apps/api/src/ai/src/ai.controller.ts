/**
 * AI Controller — Thin HTTP adapter between routes and AI services.
 *
 * Each handler:
 * 1. Reads validated `req.body` (already passed Zod validation)
 * 2. Maps request data to service function arguments
 * 3. Calls the AI service (ai-triggers.ts)
 * 4. Returns structured JSON response
 *
 * Pattern: Controller-Service separation (nodejs-backend-patterns §1).
 */

import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  generatePsychologicalResponse,
  analyzeSymptomCorrelation,
  generateDiagnosticHypothesis,
} from "./ai-triggers.js";
import { uploadAndRotateNailPhoto, uploadAndRotateFoodPhoto } from "./lib/storage.js";
import { runSomaticVisionAnalyzer } from "./graph/vision-analyzer.js";
import { runFoodVisionAnalyzer } from "./graph/food-vision-analyzer.js";
import { runLabReportAnalyzer } from "./graph/lab-report-analyzer.js";
import * as fs from "fs";
import type {
  FoodContext,
  UserProfileContext,
} from "./ai-triggers.js";
import type {
  ChatRequest,
  AnalyzeRequest,
  DiagnoseRequest,
  AnalyzeLabReportRequest,
  AnalyzeSomaticRequest,
  AnalyzeFoodRequest,
} from "./request-schemas.js";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { appGraph } from "./graph/builder.js";

// ── Deterministic Micronutrient Norms (mirrors DailyAllowancesPanel.tsx) ──

const BACKEND_BASE_MICRO_TARGETS: Record<string, number> = {
  "Калий": 3500, "Магний": 400, "Витамин A": 900, "Витамин B12": 2.4,
  "Цинк": 11, "Натрий": 1500, "Витамин C": 90, "Железо": 15,
  "Кальций": 1000, "Витамин D": 15, "Фолиевая кислота": 400, "Витамин E": 15,
  "Селен": 55, "Витамин B6": 1.3, "Йод": 150, "Фосфор": 700, "Омега-3": 1.1,
};

const BACKEND_COFACTOR_MAP: Record<string, string> = {
  'Вит С': 'Витамин C', 'Витамин С': 'Витамин C', 'Витамин C': 'Витамин C',
  'Вит D': 'Витамин D', 'Витамин D': 'Витамин D', 'Витамин D3': 'Витамин D',
  'Вит B12': 'Витамин B12', 'Витамин B12': 'Витамин B12', 'Витамин В12': 'Витамин B12',
  'Кобаламин': 'Витамин B12',
  'Вит B6': 'Витамин B6', 'Витамин B6': 'Витамин B6', 'Пиридоксин': 'Витамин B6',
  'Вит A': 'Витамин A', 'Витамин A': 'Витамин A', 'Витамин А': 'Витамин A',
  'Вит E': 'Витамин E', 'Витамин E': 'Витамин E', 'Витамин Е': 'Витамин E',
  'Фолат': 'Фолиевая кислота', 'Фолиевая кислота': 'Фолиевая кислота',
  'Железо': 'Железо', 'Fe': 'Железо', 'Ферритин': 'Железо',
  'Кальций': 'Кальций', 'Ca': 'Кальций',
  'Магний': 'Магний', 'Mg': 'Магний',
  'Цинк': 'Цинк', 'Zn': 'Цинк',
  'Селен': 'Селен', 'Se': 'Селен',
  'Йод': 'Йод', 'Калий': 'Калий',
  'Натрий': 'Натрий', 'Фосфор': 'Фосфор',
  'Омега-3': 'Омега-3', 'DHA': 'Омега-3', 'EPA': 'Омега-3',
};

const BACKEND_SEVERITY_MULT: Record<string, number> = {
  'mild': 1.15, 'moderate': 1.30, 'significant': 1.50,
};

function computeDeterministicMicros(
  profile: any,
  activeKnowledgeBases: any[] | null,
): { micros: Record<string, number>; rationale: string } {
  const micros = { ...BACKEND_BASE_MICRO_TARGETS };
  const factors: string[] = [];

  const applyMod = (key: string, mult: number) => {
    if (micros[key] !== undefined && mult !== 1) micros[key] *= mult;
  };

  if (!profile) return { micros, rationale: 'Профиль не загружен.' };

  // LAYER 0: Diagnosis-driven
  if (activeKnowledgeBases && activeKnowledgeBases.length > 0) {
    activeKnowledgeBases.forEach((diag: any) => {
      const kb = diag.knowledge_data;
      if (!kb) return;
      const sevMult = BACKEND_SEVERITY_MULT[diag.severity] || 1.15;
      const boosted: string[] = [];
      if (Array.isArray(kb.cofactors)) {
        kb.cofactors.forEach((c: string) => {
          const nk = BACKEND_COFACTOR_MAP[c];
          if (nk && micros[nk] !== undefined) { micros[nk] *= sevMult; boosted.push(nk); }
        });
      }
      if (boosted.length > 0) factors.push(`⚕️ ${diag.condition_name} [${diag.severity}] (+${boosted.join(', ')})`);
    });
  }

  // LAYER 0b: Lab reports
  if (profile.lab_diagnostic_reports && Array.isArray(profile.lab_diagnostic_reports)) {
    const latest = profile.lab_diagnostic_reports[profile.lab_diagnostic_reports.length - 1];
    if (latest?.report?.biomarker_assessments) {
      const anomalous = latest.report.biomarker_assessments.filter(
        (b: any) => b.status === 'low' || b.status === 'critical_low'
      );
      const labBoosted: string[] = [];
      anomalous.forEach((bm: any) => {
        const nk = BACKEND_COFACTOR_MAP[bm.name];
        if (nk && micros[nk] !== undefined) {
          const mult = bm.status === 'critical_low' ? 1.50 : 1.25;
          micros[nk] *= mult;
          labBoosted.push(nk);
        }
      });
      if (labBoosted.length > 0) factors.push(`🔬 Дефицит по анализам (+${labBoosted.join(', ')})`);
    }
  }

  // LAYERS 1-9: Profile modifiers
  if (profile.diet_type === 'vegan') {
    applyMod('Железо', 1.80); applyMod('Витамин B12', 2.00); applyMod('Цинк', 1.50);
    applyMod('Кальций', 1.20); applyMod('Витамин D', 1.30); applyMod('Омега-3', 1.50);
    applyMod('Витамин A', 1.40); applyMod('Йод', 1.20);
    factors.push('Веган');
  } else if (profile.diet_type === 'vegetarian') {
    applyMod('Железо', 1.50); applyMod('Витамин B12', 1.50); applyMod('Цинк', 1.25);
    applyMod('Кальций', 1.10); applyMod('Витамин D', 1.20); applyMod('Омега-3', 1.30);
    factors.push('Вегетарианец');
  } else if (profile.diet_type === 'keto') {
    applyMod('Витамин C', 1.30); applyMod('Натрий', 1.40);
    factors.push('Кето');
  }

  if (profile.activity_level === 'moderate') {
    applyMod('Магний', 1.10); applyMod('Калий', 1.10); applyMod('Витамин B6', 1.10);
    applyMod('Железо', 1.05); applyMod('Натрий', 1.10);
  } else if (profile.activity_level === 'active') {
    applyMod('Магний', 1.15); applyMod('Калий', 1.15); applyMod('Витамин B6', 1.15);
    applyMod('Железо', 1.10); applyMod('Натрий', 1.15);
    factors.push('Высокая активность');
  } else if (profile.activity_level === 'very_active') {
    applyMod('Магний', 1.25); applyMod('Калий', 1.25); applyMod('Витамин B6', 1.20);
    applyMod('Железо', 1.15); applyMod('Натрий', 1.20); applyMod('Витамин E', 1.10);
    factors.push('Очень высокая активность');
  }

  if (profile.stress_level === 'moderate') {
    applyMod('Витамин C', 1.10); applyMod('Магний', 1.10);
  } else if (profile.stress_level === 'high') {
    applyMod('Витамин C', 1.30); applyMod('Магний', 1.20); applyMod('Витамин B6', 1.15);
    applyMod('Витамин B12', 1.10);
    factors.push('Высокий стресс');
  } else if (profile.stress_level === 'very_high') {
    applyMod('Витамин C', 1.50); applyMod('Магний', 1.30); applyMod('Витамин B6', 1.25);
    applyMod('Витамин B12', 1.20);
    factors.push('Очень высокий стресс');
  }

  if (profile.sun_exposure === 'minimal') {
    applyMod('Витамин D', 1.60); factors.push('Мало солнца');
  } else if (profile.sun_exposure === 'moderate') {
    applyMod('Витамин D', 1.20);
  }

  if (profile.climate_zone === 'polar') {
    applyMod('Витамин D', 1.50); applyMod('Витамин C', 1.20); applyMod('Йод', 1.10);
    factors.push('Полярный климат');
  } else if (profile.climate_zone === 'continental') {
    applyMod('Витамин D', 1.30); applyMod('Витамин C', 1.10);
  } else if (profile.climate_zone === 'temperate') {
    applyMod('Витамин D', 1.20);
  }

  if (profile.is_smoker) {
    applyMod('Витамин C', 1.80); applyMod('Витамин E', 1.30);
    applyMod('Селен', 1.20); applyMod('Фолиевая кислота', 1.25);
    factors.push('Курение');
  }

  if (profile.alcohol_frequency === 'moderate') {
    applyMod('Витамин B12', 1.15); applyMod('Фолиевая кислота', 1.15);
    applyMod('Магний', 1.10); applyMod('Цинк', 1.10);
  } else if (profile.alcohol_frequency === 'heavy') {
    applyMod('Витамин B12', 1.30); applyMod('Фолиевая кислота', 1.30);
    applyMod('Магний', 1.20); applyMod('Цинк', 1.20);
    factors.push('Частый алкоголь');
  }

  if (profile.pregnancy_status === 'pregnant') {
    applyMod('Фолиевая кислота', 1.50); applyMod('Железо', 1.80); applyMod('Кальций', 1.30);
    applyMod('Витамин D', 1.30); applyMod('Йод', 1.50); applyMod('Омега-3', 1.50);
    factors.push('Беременность');
  } else if (profile.pregnancy_status === 'breastfeeding') {
    applyMod('Фолиевая кислота', 1.25); applyMod('Железо', 1.20); applyMod('Кальций', 1.20);
    applyMod('Витамин D', 1.20); applyMod('Йод', 1.60); applyMod('Омега-3', 1.30);
    factors.push('Грудное вскармливание');
  }

  if (profile.biological_sex === 'female') {
    applyMod('Железо', 1.20); factors.push('Жен. пол');
  }

  for (const key of Object.keys(micros)) micros[key] = Number(micros[key].toFixed(1));

  const rationale = factors.length > 0
    ? `Индивидуальные нормы (${factors.join(', ')}).`
    : 'Базовая норма.';

  return { micros, rationale };
}

// ── Database Context Utility ────────────────────────────────────────

async function fetchUserContext(token: string, userId: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [profileRes, resultsRes, mealsRes, kbRes, suppLogsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("test_results")
        .select("*, biomarkers(name_en, name_ru, unit)")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(20),
      supabase
        .from("meal_logs")
        .select("id, logged_at, total_calories, micronutrients, meal_items(food_name, portion_grams, calories, protein_g, fat_g, carbs_g)")
        .eq("user_id", userId)
        .gte("logged_at", startOfDay.toISOString())
        .order("logged_at", { ascending: true }),
      supabase
        .from("active_condition_knowledge_bases")
        .select("*")
        .eq("profile_id", userId)
        .eq("is_active", true),
      supabase
        .from("supplement_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("taken_at", startOfDay.toISOString())
        .order("taken_at", { ascending: true })
    ]);

    return {
      profile: profileRes.data,
      recentTests: resultsRes.data,
      recentMeals: mealsRes.data,
      activeKnowledgeBases: kbRes.data,
      todaySupplements: suppLogsRes.data,
    };
  } catch (error) {
    console.error("[fetchUserContext] Error fetching context:", error);
    return null;
  }
}


// ── Context Formatting Helpers ─────────────────────────────────────

function formatTestResults(tests: any[] | null): string {
  if (!tests || tests.length === 0) return "Нет загруженных анализов.";

  return tests.map(t => {
    const name = t.biomarkers?.name_ru || t.biomarkers?.name_en || "Неизвестный маркер";
    const date = new Date(t.test_date).toLocaleDateString("ru-RU");
    return `- [${date}] ${name}: ${t.value} ${t.unit}`;
  }).join("\n");
}

function formatMealLogs(meals: any[] | null): string {
  if (!meals || meals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  return meals.map(m => {
    const time = new Date(m.logged_at).toLocaleTimeString("ru-RU", {
      hour: '2-digit', minute: '2-digit'
    });

    let text = `- [${time}]`;
    let mTotalCal = 0, mTotalP = 0, mTotalF = 0, mTotalC = 0;

    if (m.meal_items && Array.isArray(m.meal_items) && m.meal_items.length > 0) {
      const itemsText = m.meal_items.map((i: any) => {
        mTotalCal += i.calories || 0;
        mTotalP += i.protein_g || 0;
        mTotalF += i.fat_g || 0;
        mTotalC += i.carbs_g || 0;
        return `${i.food_name || 'Неизвестное блюдо'} (${i.portion_grams}г)`;
      }).join(', ');
      text += ` ${itemsText}: ${Math.round(mTotalCal)} ккал, Б${Math.round(mTotalP)}г, Ж${Math.round(mTotalF)}г, У${Math.round(mTotalC)}г`;
    } else {
      text += ` Приём пищи (без деталей)`;
    }

    if (m.micronutrients && typeof m.micronutrients === 'object') {
      const micros = Object.entries(m.micronutrients)
        .filter(([_, v]) => typeof v === 'number' && (v as number) > 0)
        .map(([k, v]) => {
          const name = k.split(' (')[0];
          return `${name}: ${(v as number).toFixed(1)}`;
        })
        .join(', ');
      if (micros) text += `\n  Микро: ${micros}`;
    }

    return text;
  }).join("\n");
}

// ── Nutrition Targets Formatter (Phase 53e — Deterministic) ──────────

/**
 * Formats deterministic nutrition targets for the system prompt.
 * Uses computeDeterministicMicros instead of stale active_nutrition_targets.
 */
function formatNutritionTargets(profile: any, activeKnowledgeBases: any[] | null): string {
  const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases);

  let text = `${rationale}\n`;

  const targets = profile?.active_nutrition_targets;
  if (targets?.macros) {
    text += `Макросы: Ккал=${targets.macros.calories || 2000}, Белки=${targets.macros.protein || 120}г, Жиры=${targets.macros.fat || 60}г, Углеводы=${targets.macros.carbs || 250}г\n`;
  } else {
    text += `Макросы: Ккал=2000, Белки=120г, Жиры=60г, Углеводы=250г (стандарт)\n`;
  }

  const microEntries = Object.entries(micros).map(([k, v]) => `${k}: ${v}`).join(", ");
  text += `Микронутриенты: ${microEntries}\n`;

  return text;
}

/**
 * Aggregates today's consumed nutrients from meal_logs into a summary for deficit calculation.
 */
function formatTodayProgress(meals: any[] | null): string {
  if (!meals || meals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  let totalCal = 0, totalP = 0, totalF = 0, totalC = 0;
  const microTotals: Record<string, number> = {};

  for (const m of meals) {
    totalCal += m.total_calories || 0;
    if (m.meal_items && Array.isArray(m.meal_items)) {
      for (const i of m.meal_items) {
        totalP += i.protein_g || 0;
        totalF += i.fat_g || 0;
        totalC += i.carbs_g || 0;
      }
    }
    if (m.micronutrients && typeof m.micronutrients === 'object') {
      for (const [key, val] of Object.entries(m.micronutrients)) {
        if (typeof val === 'number') {
          microTotals[key] = (microTotals[key] || 0) + val;
        }
      }
    }
  }

  let text = `Макросы: ${Math.round(totalCal)} ккал, Белки ${Math.round(totalP)}г, Жиры ${Math.round(totalF)}г, Углеводы ${Math.round(totalC)}г\n`;
  text += `Приёмов пищи: ${meals.length}\n`;

  if (Object.keys(microTotals).length > 0) {
    const entries = Object.entries(microTotals).map(([k, v]) => `${k}: ${Number(v).toFixed(1)}`).join(", ");
    text += `Микронутриенты (сумма): ${entries}\n`;
  } else {
    text += `Микронутриенты: данных нет.\n`;
  }

  return text;
}

// ── Dietary Restrictions Formatter ──────────────────────────────────

/**
 * Extracts user-set dietary restrictions from profile.lifestyle_markers
 * and formats them as an explicit block for the LLM system prompt.
 *
 * @param profile - Raw profile object from Supabase (with lifestyle_markers JSONB)
 * @returns Formatted restriction block or empty string if none set
 */
function formatDietaryRestrictions(profile: any): string {
  if (!profile) return "";

  const markers = profile.lifestyle_markers || profile.lifestyleMarkers;
  if (!markers) return "";

  const restrictions: string[] = Array.isArray(markers.dietary_restrictions)
    ? markers.dietary_restrictions
    : [];

  if (restrictions.length === 0) return "";

  const formatted = restrictions
    .map((r: string, i: number) => `${i + 1}. ❌ ${r}`)
    .join("\n");

  return `\n--- ACTIVE DIETARY RESTRICTIONS (NON-NEGOTIABLE) ---\n${formatted}\n`;
}

// ── Active Knowledge Base Formatter ──────────────────────────────────

/**
 * Formats active medical condition knowledge bases for the AI context.
 */
function formatActiveKnowledgeBases(kbs: any[] | null): string {
  if (!kbs || kbs.length === 0) return "";

  let kbContext = `\n--- АКТИВНЫЕ ДИАГНОЗЫ И БАЗЫ ЗНАНИЙ (Phase 49) ---\n`;
  kbContext += `Пользователь в данный момент имеет следующие активные клинические паттерны. ИСПОЛЬЗУЙ ЭТИ ДАННЫЕ для корректировки питания и образа жизни:\n\n`;

  kbs.forEach((kb) => {
    const data = kb.knowledge_data;
    if (!data) return;

    kbContext += `### ${kb.condition_name} (Степень: ${kb.severity})\n`;
    kbContext += `- Патофизиология: ${data.pathophysiology_simple || 'N/A'}\n`;
    kbContext += `- Кофакторы (Помогают): ${data.cofactors?.join(", ") || 'N/A'}\n`;
    kbContext += `- Ингибиторы (Мешают): ${data.inhibitors?.join(", ") || 'N/A'}\n`;
    kbContext += `- Правила образа жизни: ${data.lifestyle_rules?.join("; ") || 'N/A'}\n\n`;
  });

  return kbContext;
}

// ── Supplement Protocol Formatter ────────────────────────────────────

/**
 * Formats the active supplement protocol for the AI context.
 */
function formatActiveSupplementProtocol(profile: any): string {
  if (!profile || !profile.active_supplement_protocol || Object.keys(profile.active_supplement_protocol).length === 0) return "";

  const proto = profile.active_supplement_protocol;
  let protoContext = `\n--- АКТИВНЫЙ ПРОТОКОЛ ДОБАВОК И ВИТАМИНОВ (Phase 50) ---\n`;
  protoContext += `Пользователю назначен следующий протокол компенсации дефицитов. НАПОМИНАЙ ему о времени приема и совместимости:\n\n`;
  protoContext += `Название: ${proto.title}\n`;
  protoContext += `Обоснование: ${proto.protocol_rationale}\n\n`;

  if (Array.isArray(proto.items)) {
    protoContext += `**Назначенные добавки:**\n`;
    proto.items.forEach((item: any) => {
      protoContext += `- ${item.name_ru} (${item.dosage}). Время: ${item.timing}, ${item.food_relation}. Длительность: ${item.duration_weeks} нед.\n`;
      if (item.antagonists && item.antagonists.length > 0) {
        protoContext += `  ⚠️ Несовместимо с: ${item.antagonists.join(", ")}\n`;
      }
    });
  }

  if (Array.isArray(proto.warnings) && proto.warnings.length > 0) {
    protoContext += `\n**Общие предупреждения:**\n${proto.warnings.map((w: string) => `- ${w}`).join("\n")}\n`;
  }

  return protoContext + "\n";
}

// ── Supplement Logs Formatter ────────────────────────────────────────

function formatTodaySupplements(logs: any[] | null): string {
  if (!logs || logs.length === 0) return "Сегодня пользователь еще не отмечал прием БАДов.";

  return logs.map(l => {
    const time = new Date(l.taken_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
    const status = l.was_on_time ? "✅ Вовремя" : "⚠️ С опозданием / Не по графику";
    return `- [${time}] ${l.supplement_name} (${l.dosage_taken}) — ${status}`;
  }).join("\n");
}

// ── Lab Diagnostic Report Formatter ───────────────────────────────────

/**
 * Extracts the latest lab diagnostic report from the profile
 * and formats it as a context block for the chat system prompt.
 */
function formatLabDiagnosticReport(profile: any): string {
  if (!profile) return "";

  let baseContext = "";

  // Extract personal food zones from profile
  const foodZones = profile.food_contraindication_zones;
  if (foodZones && Object.keys(foodZones).length > 0) {
    baseContext += `\n--- ПЕРСОНАЛЬНЫЕ ЗОНЫ ПРОДУКТОВ (ОТКЛОНЕНИЯ ПО АНАЛИЗАМ) ---\n`;

    if (Array.isArray(foodZones.red) && foodZones.red.length > 0) {
      baseContext += `🔴 КРАСНАЯ ЗОНА (СТРОГИЙ ЗАПРЕТ):\n` + foodZones.red.map((i: any) => `- ${i.substance} (Например: ${i.found_in?.join(', ') || 'N/A'}): ${i.reason}`).join('\n') + '\n';
    }
    if (Array.isArray(foodZones.yellow) && foodZones.yellow.length > 0) {
      baseContext += `🟡 ЖЁЛТАЯ ЗОНА (ОГРАНИЧЕНО):\n` + foodZones.yellow.map((i: any) => `- ${i.substance} (Лимит: ${i.daily_limit || 'умеренно'}): ${i.reason}`).join('\n') + '\n';
    }
    if (Array.isArray(foodZones.green) && foodZones.green.length > 0) {
      baseContext += `🟢 ЗЕЛЁНАЯ ЗОНА (РЕКОМЕНДОВАНО):\n` + foodZones.green.map((i: any) => `- ${i.substance} (Доза: ${i.daily_limit || 'ежедневно'}): ${i.reason}`).join('\n') + '\n';
    }
    baseContext += `СТРОГО УЧИТЫВАЙ ЭТИ ЗОНЫ ПРИ ОЦЕНКЕ ПРОДУКТОВ НА ФОТО.\n`;
  }

  const reports = profile.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return baseContext;

  const latest = reports[reports.length - 1];
  const report = latest.report;
  if (!report) return baseContext;

  const patterns = report.diagnostic_patterns
    ?.map((p: any) => p.pattern_name)
    .join(", ") || "Нет";

  const priorities = report.priority_actions
    ?.map((a: any) => `[${a.priority}] ${a.action}`)
    .join("; ") || "Нет";

  return baseContext +
    `\n--- ПОСЛЕДНИЙ ОТЧЁТ ПО АНАЛИЗАМ (от ${latest.timestamp}) ---\n` +
    `Резюме: ${report.summary}\n` +
    `Паттерны: ${patterns}\n` +
    `Приоритеты: ${priorities}\n` +
    `\nИспользуй эту информацию для персонализации диалога. Ты ЗНАЕШЬ результаты анализов пользователя.`;
}

// ── Default user profile for requests without explicit profile ───────

const DEFAULT_USER_PROFILE = {
  age: 30, // Default age fallback
  biologicalSex: null,
  dietType: null,
  chronicConditions: [],
  activityLevel: null,
  is_smoker: false,
  is_pregnant: false,
};

// ── POST /api/v1/ai/chat ────────────────────────────────────────────

/**
 * Handles the conversational chat endpoint using LangGraph.
 * Maintains memory via threadId and can call tools like calculateNorms.
 */
export async function handleChat(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as ChatRequest;
    const chatMode = body.chatMode || "diary";

    const messagesToInvoke: any[] = [];

    if (chatMode === "assistant" && req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        const dbContext = await fetchUserContext(token, req.user.id);
        if (dbContext) {
          // 🚨 PREVENT TOKEN EXPLOSION 🚨
          // Strip out massive arrays and objects that are already formatted elsewhere 
          // or contain huge JSON dumps (like PDF lab reports).
          const safeProfile = { ...dbContext.profile };
          delete safeProfile.lab_diagnostic_reports; // Formatted by formatLabDiagnosticReport
          delete safeProfile.active_supplement_protocol; // Formatted by formatActiveSupplementProtocol
          delete safeProfile.food_contraindication_zones; // Formatted by formatLabDiagnosticReport

          // If nail_analysis_history is huge, keep only the most recent one
          if (safeProfile.somatic_data && Array.isArray(safeProfile.somatic_data.nail_analysis_history)) {
            const hist = safeProfile.somatic_data.nail_analysis_history;
            safeProfile.somatic_data = {
              ...safeProfile.somatic_data,
              nail_analysis_history: hist.length > 0 ? [hist[hist.length - 1]] : []
            };
          }

          const systemPrompt = `You are a Strict but Supportive Friend. You are an AI Assistant that helps the user interpret their health data and keeps them accountable to their goals.
ROLE:
- Act as a "Strict but Supportive Friend".
- Be empathetic but firm when the user suggests harmful decisions based on their clinical profile.
- Politely refuse requests that cross medical boundaries (e.g., diagnosing illnesses or prescribing medications).
- Always use the provided user clinical context to personalize your responses.
- ALWAYS respond in Russian language.
- CRITICAL: When the user mentions a lifestyle change (e.g. sleep, diet, stress), USE THE \`update_user_profile\` TOOL to save it to their profile.
- CRITICAL VISION AWARENESS: If the user asks about an uploaded photo or their nails, DO NOT say you cannot see photos. Instead, look at the \`somatic_data.nail_analysis_history\` in their PROFILE JSON below. Read the latest analysis results from that history and provide recommendations based on those extracted markers.
- CRITICAL CONTEXT AWARENESS: You have explicit access to the user's latest Blood Tests ("Анализы Крови") and Diet History ("Рацион Питания"). Use this to answer any questions about what they ate or what their biomarkers are.
- When the user reports eating something, you MUST aggressively estimate its vitamins and minerals before calling the log_meal tool.
- When logging a meal, evaluate its healthiness and pass a \`meal_quality_score\` (0-100) and \`meal_quality_reason\` (max 150 chars in Russian) to the \`log_meal\` tool. Scoring guide: 86-100 (Ideal/Balanced), 70-85 (Good but minor issues), 40-69 (Average), 0-39 (Poor/Junk food/Sugar).

STRICT DIETARY ENFORCEMENT RULES:
- The user may set ABSOLUTE dietary restrictions (e.g., "never allow me to eat white sugar").
- These restrictions are stored in the user's profile under lifestyle_markers.dietary_restrictions.
- When the user mentions consuming or planning to consume a BANNED product:
  1. DO NOT offer compromises ("if you decide to eat it anyway...").
  2. DO NOT suggest "moderation" or "just this once".
  3. FIRMLY but kindly REFUSE to approve the choice. Say something like: "Стоп! Мы же договорились — никакого белого сахара. Я здесь, чтобы тебя удержать. Давай лучше..."
  4. Immediately offer 2-3 healthy alternatives.
  5. Remind the user WHY they set this rule (if the reason is in their profile).
- Treat user-set restrictions as NON-NEGOTIABLE CONTRACTS. The user explicitly asked you to be strict — honor that request. If they want to cancel the restriction, they must do so explicitly (e.g., "Я снимаю запрет на сахар").
- NEVER undermine the user's own discipline. You are their accountability partner, not a diplomat.

USER CLINICAL CONTEXT:

--- PROFILE OVERVIEW ---
${JSON.stringify(safeProfile)}
${formatDietaryRestrictions(dbContext.profile)}
--- RECENT BLOOD TESTS (Анализы Крови) ---
${formatTestResults(dbContext.recentTests)}

--- ИНДИВИДУАЛЬНЫЕ НОРМЫ ПИТАНИЯ (Детерминированные, Phase 53c+53d) ---
${formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases)}

--- СЪЕДЕНО СЕГОДНЯ ---
Агрегированный итог:
${formatTodayProgress(dbContext.recentMeals)}

Детальный лог приёмов пищи:
${formatMealLogs(dbContext.recentMeals)}

${formatLabDiagnosticReport(dbContext.profile)}
${formatActiveKnowledgeBases(dbContext.activeKnowledgeBases)}
${formatActiveSupplementProtocol(dbContext.profile)}

--- ВЫПИТЫЕ СЕГОДНЯ БАДЫ (Compliance) ---
${formatTodaySupplements(dbContext.todaySupplements)}
Если пользователь забыл выпить что-то из Активного Протокола — мягко, но настойчиво напомни!

--- CRITICAL DEFICIT-AWARE FOOD ADVICE RULE ---
When the user asks what to eat (e.g. "что съесть?", "что приготовить на ужин?"), you MUST:
1. FOR EACH micronutrient in 'ИНДИВИДУАЛЬНЫЕ НОРМЫ ПИТАНИЯ':
   - Read the TARGET value (e.g., Железо: 22.5 мг).
   - Read the CONSUMED value from 'СЪЕДЕНО СЕГОДНЯ' aggregate (e.g., Железо: 2.5 мг).
   - Calculate the REMAINING DEFICIT: 22.5 - 2.5 = 20.0 мг.
2. Sort the deficits from LARGEST to SMALLEST percentage gap.
3. Recommend foods that fill the TOP 3 BIGGEST gaps.
4. If a nutrient is ALREADY OVER 100% of the target, DO NOT recommend more of it. Say "X уже закрыт на сегодня."
5. NEVER recommend a food that is in 🔴 КРАСНАЯ ЗОНА or violates ACTIVE DIETARY RESTRICTIONS.
6. Example output format:
   "Сегодня тебе нужно добрать:
   - Железо: осталось 20 мг из 22.5 → Попробуй чечевицу (100г = 6.6мг) или шпинат.
   - Витамин D: осталось 25 мкг из 31 → Жирная рыба (лосось, скумбрия).
   - B12 уже закрыт — больше не нужно.
   ⚠️ Избегай: [красная зона products]."
`;
          messagesToInvoke.push(new SystemMessage(systemPrompt));
        }
      }
      messagesToInvoke.push(new HumanMessage(body.message));
    } else {
      // Original diary fallback
      const profile = body.userProfile
        ? { ...DEFAULT_USER_PROFILE, ...body.userProfile }
        : DEFAULT_USER_PROFILE;

      const contextStr = JSON.stringify(profile);
      const systemPromptDiary = `You are a strict nutritionist AI.
ROLE:
- Listen to what the user eats and extract BOTH macros AND micronutrients (vitamins, minerals).
- Evaluate the overall healthiness of the meal and assign a meal_quality_score from 0 to 100.
  (86-100: Ideal, 70-85: Good but minor issues, 40-69: Average, 0-39: Poor/Junk food).
- Provide a brief meal_quality_reason (max 150 chars).
- Use the \`log_meal\` tool to save the macros AND the quality score/reason to the database.
- Keep your text response brief ("Записал 200г овсянки: 130 ккал, 4г белка, 2г жира, 25г уг").

User Context: ${contextStr}`;

      messagesToInvoke.push(new SystemMessage(systemPromptDiary));
      messagesToInvoke.push(new HumanMessage(`Log this meal: ${body.message}`));
    }

    console.log(`[LangGraph] Invoking graph for mode: ${chatMode}`);

    // Deterministic thread ID per user and chat mode
    const actualThreadId = `${req.user?.id || 'anon'}-${chatMode}`;

    // Invoke the graph
    const result = await appGraph.invoke(
      { messages: messagesToInvoke },
      {
        configurable: {
          thread_id: actualThreadId,
          user_id: req.user?.id,
          token: req.headers.authorization?.split(" ")[1]
        }
      }
    );

    // Extract the final message from the state
    const finalMessages = result.messages;
    const aiResponse = finalMessages[finalMessages.length - 1];

    let finalContent = typeof aiResponse.content === "string" ? aiResponse.content : "";

    // Search backwards for log_meal tool calls to forcefully inject the score tag
    // if the LLM forgot to include it in the final markdown.
    let foundLogMeal = false;
    for (let i = finalMessages.length - 1; i >= 0; i--) {
      const msg = finalMessages[i];
      if (msg._getType && msg._getType() === "ai" && Array.isArray((msg as any).tool_calls) && (msg as any).tool_calls.length > 0) {
        console.log(`[Diagnostic] Found AIMessage with tool_calls:`, JSON.stringify((msg as any).tool_calls, null, 2));
        const logMealCall = (msg as any).tool_calls.find((tc: any) => tc.name === "log_meal");
        if (logMealCall) {
          foundLogMeal = true;
          console.log(`[Diagnostic] log_meal args:`, JSON.stringify(logMealCall.args, null, 2));

          let score = logMealCall.args?.meal_quality_score;
          let reason = logMealCall.args?.meal_quality_reason || "";

          // Fallback: The LLM often prints "Оценка: 70. Хороший источник..." directly in text instead of tool args
          if (score === undefined || score === null) {
            const textMatch = finalContent.match(/Оценка\s*[-:]?\s*(\d+)(?:\s*\.\s*(.*))?/i);
            if (textMatch) {
              score = parseInt(textMatch[1], 10);
              reason = textMatch[2] ? textMatch[2].trim().substring(0, 100) : "";
              console.log(`[Diagnostic] Extracted score ${score} from LLM text instead of tool args.`);
            }
          }

          // Absolute fallback: If totally missing, enforce a default so the badge doesn't disappear
          if (score === undefined || score === null || isNaN(score)) {
            score = 75; // Average baseline
            reason = "Оценка по умолчанию от ИИ";
            console.log(`[Diagnostic] Score totally missing, applying default of 75.`);
          }

          // Fallback for Micronutrients tags
          let microsDetected = false;
          let microsStr = "";
          if (logMealCall.args?.micronutrients) {
            const m = logMealCall.args.micronutrients;
            const mappings = [
              { key: 'vitamin_c_mg', name: 'Витамин C', unit: 'мг', type: 'vitamin_c' },
              { key: 'витамин_c_mg', name: 'Витамин C', unit: 'мг', type: 'vitamin_c' },
              { key: 'vitamin_d_mcg', name: 'Витамин D', unit: 'мкг', type: 'vitamin_d' },
              { key: 'витамин_d_mcg', name: 'Витамин D', unit: 'мкг', type: 'vitamin_d' },
              { key: 'vitamin_b12_mcg', name: 'Витамин B12', unit: 'мкг', type: 'vitamin_b' },
              { key: 'витамин_b12_mcg', name: 'Витамин B12', unit: 'мкг', type: 'vitamin_b' },
              { key: 'folate_mcg', name: 'Фолиевая кислота', unit: 'мкг', type: 'vitamin_b' },
              { key: 'фолиевая_кислота_mcg', name: 'Фолиевая кислота', unit: 'мкг', type: 'vitamin_b' },
              { key: 'iron_mg', name: 'Железо', unit: 'мг', type: 'iron' },
              { key: 'железо_mg', name: 'Железо', unit: 'мг', type: 'iron' },
              { key: 'calcium_mg', name: 'Кальций', unit: 'мг', type: 'calcium' },
              { key: 'кальций_mg', name: 'Кальций', unit: 'мг', type: 'calcium' },
              { key: 'magnesium_mg', name: 'Магний', unit: 'мг', type: 'magnesium' },
              { key: 'магний_mg', name: 'Магний', unit: 'мг', type: 'magnesium' },
              { key: 'zinc_mg', name: 'Цинк', unit: 'мг', type: 'default' },
              { key: 'цинк_mg', name: 'Цинк', unit: 'мг', type: 'default' },
              { key: 'selenium_mcg', name: 'Селен', unit: 'мкг', type: 'default' },
              { key: 'селен_mcg', name: 'Селен', unit: 'мкг', type: 'default' },
              { key: 'potassium_mg', name: 'Калий', unit: 'мг', type: 'default' },
              { key: 'калий_mg', name: 'Калий', unit: 'мг', type: 'default' },
              { key: 'sodium_mg', name: 'Натрий', unit: 'мг', type: 'default' },
              { key: 'натрий_mg', name: 'Натрий', unit: 'мг', type: 'default' },
              { key: 'omega_3_mg', name: 'Омега-3', unit: 'мг', type: 'omega' }, // Assuming this might be added later
            ];

            mappings.forEach(mapping => {
              if (m[mapping.key]) {
                microsDetected = true;
                if (!finalContent.includes(`<nutr type="${mapping.type}">${mapping.name}`)) {
                  microsStr += ` <nutr type="${mapping.type}">${mapping.name} (${m[mapping.key]}${mapping.unit})</nutr>`;
                }
              }
            });
          }

          if (microsDetected && microsStr) {
            console.log(`[Diagnostic] Injecting <nutr> tags into finalContent:`, microsStr);
            finalContent += `\n\nМикронутриенты: ${microsStr}`;
          }

          if (!finalContent.includes("<meal_score")) {
            console.log(`[Diagnostic] Injecting <meal_score> tag into finalContent`);
            finalContent += `\n\n<meal_score score="${score}" reason="${reason}" />`;
          } else {
            console.log(`[Diagnostic] finalContent already had <meal_score> tag`);
          }
        }
        break; // Found the latest AI generation block
      }
    }

    if (!foundLogMeal) {
      console.log(`[Diagnostic] No log_meal tool call found in the recent message history!`);
    }

    // --- Save messages to ai_chat_messages ---
    if (req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

      if (token && supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        });

        const userMsgPayload: any = {
          user_id: req.user.id,
          thread_id: actualThreadId,
          role: "user",
          content: body.message,
        };
        if (body.imageUrl) {
          userMsgPayload.image_url = body.imageUrl;
        }

        const aiMsgPayload = {
          user_id: req.user.id,
          thread_id: actualThreadId,
          role: "assistant",
          content: finalContent,
        };

        // Delay AI message timestamp slightly to ensure consistent ordering on rapid inserts
        const { error: err1 } = await supabase.from("ai_chat_messages").insert([userMsgPayload]);
        if (err1) console.error("[handleChat] Error inserting user msg:", err1);

        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay

        const { error: err2 } = await supabase.from("ai_chat_messages").insert([aiMsgPayload]);
        if (err2) console.error("[handleChat] Error inserting AI msg:", err2);
      }
    }

    res.json({
      success: true,
      data: {
        response: finalContent,
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── POST /api/v1/ai/analyze ─────────────────────────────────────────

/**
 * Handles the symptom correlation analysis endpoint.
 *
 * Passes validated symptom entries directly to
 * `analyzeSymptomCorrelation()`.
 */
export async function handleAnalyze(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as AnalyzeRequest;

    const result = await analyzeSymptomCorrelation(body.symptoms);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── POST /api/v1/ai/diagnose ────────────────────────────────────────

/**
 * Handles the diagnostic hypothesis generation endpoint.
 *
 * Passes symptoms and optional biomarkers to
 * `generateDiagnosticHypothesis()`.
 */
export async function handleDiagnose(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as DiagnoseRequest;

    const result = await generateDiagnosticHypothesis(
      body.symptoms,
      body.biomarkers ?? [],
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── POST /api/v1/ai/analyze-somatic ───────────────────────────────────

/**
 * Handles the somatic photo analysis endpoint.
 * Passes the image to LangChain vision node (gpt-4o) to extract markers.
 */
export async function handleAnalyzeSomatic(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as AnalyzeSomaticRequest;
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Upload the base64 photo to Supabase Storage and rotate
    const imageUrl = await uploadAndRotateNailPhoto(userId, body.imageBase64, token);

    // 2. Pass the public URL to the LangGraph Vision Node, alongside the target body part
    const result = await runSomaticVisionAnalyzer(imageUrl, userId, token, body.type);

    res.json({
      success: true,
      data: {
        ...result,
        imageUrl, // Return the URL so the frontend can display a thumbnail
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── GET /api/v1/ai/chat/history ─────────────────────────────────────

/**
 * Endpoint to fetch the global chat history for the user.
 * Reads from the `ai_chat_messages` table.
 */
export async function handleGetChatHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const mode = req.query.mode || "assistant";
    const actualThreadId = `${userId}-${mode}`;
    const startDateQuery = req.query.startDate as string | undefined;
    const endDateQuery = req.query.endDate as string | undefined;

    let query = supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("thread_id", actualThreadId)
      .order("created_at", { ascending: true });

    if (startDateQuery && endDateQuery) {
      query = query
        .gte("created_at", startDateQuery)
        .lte("created_at", endDateQuery);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("[handleGetChatHistory] DB Error:", error);
      throw error;
    }

    const history = (messages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      imageUrl: msg.image_url || undefined,
      createdAt: msg.created_at,
    }));

    res.json({
      success: true,
      data: { history },
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── POST /api/v1/ai/analyze-food ────────────────────────────────────

/**
 * Handles the food photo analysis endpoint.
 * Uploads image → GPT-4o Vision analysis → auto-save to meal_logs.
 */
export async function handleAnalyzeFood(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as AnalyzeFoodRequest;
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Upload the base64 photo to Supabase Storage (food_photos bucket)
    const imageUrl = await uploadAndRotateFoodPhoto(userId, body.imageBase64, token);

    // 2. Fetch user context (profile, deficits, dietary restrictions)
    const dbContext = await fetchUserContext(token, userId);
    const userContext = dbContext
      ? JSON.stringify({
        profile: dbContext.profile,
        recentTests: dbContext.recentTests,
        dietaryRestrictions: formatDietaryRestrictions(dbContext.profile),
        activeKnowledgeBases: formatActiveKnowledgeBases(dbContext.activeKnowledgeBases),
      })
      : "No user context available";

    // 3. Run GPT-4o Vision food analyzer
    const { data: result, errorMessage: llmError } = await runFoodVisionAnalyzer(imageUrl, userContext);

    // 4. Auto-save recognized items to meal_logs
    if (result.items.length > 0 || (result.supplements && result.supplements.length > 0)) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const mealLogsToInsert: any[] = [];
        const mealItemsToInsert: any[] = [];

        // 1. Group recognized items into a single meal_log per user request
        const totalMicros: Record<string, number> = {};
        const isoNow = new Date().toISOString();
        let totalCals = 0;

        result.items.forEach((item) => {
          totalCals += item.estimated_total.calories_kcal || 0;
          const calcMicro = (valuePer100g: number | null | undefined) => {
            if (typeof valuePer100g !== 'number') return 0;
            return Number(((valuePer100g * item.estimated_weight_g) / 100).toFixed(2));
          };
          const p100 = item.per_100g;
          const microsRaw = {
            "Витамин A (мкг)": calcMicro(p100.vitamin_a_mcg),
            "Витамин C (мг)": calcMicro(p100.vitamin_c_mg),
            "Витамин D (мкг)": calcMicro(p100.vitamin_d_mcg),
            "Витамин E (мг)": calcMicro(p100.vitamin_e_mg),
            "Витамин B12 (мкг)": calcMicro(p100.vitamin_b12_mcg),
            "Фолиевая кислота (мкг)": calcMicro(p100.folate_mcg),
            "Железо (мг)": calcMicro(p100.iron_mg),
            "Кальций (мг)": calcMicro(p100.calcium_mg),
            "Магний (мг)": calcMicro(p100.magnesium_mg),
            "Цинк (мг)": calcMicro(p100.zinc_mg),
            "Селен (мкг)": calcMicro(p100.selenium_mcg),
            "Калий (мг)": calcMicro(p100.potassium_mg),
            "Натрий (мг)": calcMicro(p100.sodium_mg),
          };
          Object.entries(microsRaw).forEach(([k, v]) => {
            if (v > 0) totalMicros[k] = (totalMicros[k] || 0) + v;
          });
        });

        if (result.supplements) {
          for (const suppl of result.supplements) {
            if (suppl.active_ingredients && Array.isArray(suppl.active_ingredients)) {
              for (const ing of suppl.active_ingredients) {
                const key = `${ing.ingredient_name} (${ing.unit})`;
                totalMicros[key] = (totalMicros[key] || 0) + ing.amount;
              }
            }
          }
        }

        const { data: logArray, error: logError } = await supabase
          .from("meal_logs")
          .insert({
            user_id: userId,
            meal_type: "snack", // default for vision
            total_calories: totalCals,
            micronutrients: totalMicros,
            source: "photo",
            logged_at: isoNow,
            meal_quality_score: result.meal_quality_score,
            meal_quality_reason: result.meal_quality_reason,
            notes: "Vision AI Logged"
          }).select("id");

        if (logError || !logArray || logArray.length === 0) {
          console.error("[FoodVision] Failed to save to meal_logs:", logError);
        } else {
          const logId = logArray[0].id;

          result.items.forEach((item) => {
            mealItemsToInsert.push({
              meal_log_id: logId,
              food_name: item.name_ru,
              weight_g: item.estimated_weight_g,
              calories: item.estimated_total.calories_kcal,
              protein_g: item.estimated_total.protein_g,
              fat_g: item.estimated_total.fat_g,
              carbs_g: item.estimated_total.carbs_g,
            });
          });

          if (result.supplements) {
            for (const suppl of result.supplements) {
              mealItemsToInsert.push({
                meal_log_id: logId,
                food_name: suppl.name_ru + (suppl.serving_size_taken > 1 ? ` (${suppl.serving_size_taken} порц.)` : ""),
                weight_g: 0,
                calories: 0,
                protein_g: 0,
                fat_g: 0,
                carbs_g: 0,
              });
            }
          }

          if (mealItemsToInsert.length > 0) {
            const { error: itemsError } = await supabase.from("meal_items").insert(mealItemsToInsert);
            if (itemsError) {
              console.error("[FoodVision] Failed to save to meal_items:", itemsError);
            } else {
              console.log(`[FoodVision] Saved ${mealItemsToInsert.length} items to meal_items for user ${userId}`);
            }
          }
        }

        // --- Save to ai_chat_messages ---
        const actualThreadId = `${userId}-diary`;
        const userMsgPayload: any = {
          user_id: userId,
          thread_id: actualThreadId,
          role: "user",
          content: "Пользователь загрузил фото еды",
          image_url: imageUrl,
        };
        const aiContent = (result.items.map((i: any) => i.name_ru).join(", ") || "Распознал фото.") + `\n\n<meal_score score="${result.meal_quality_score}" reason="${result.meal_quality_reason}" />`;

        const aiMsgPayload = {
          user_id: userId,
          thread_id: actualThreadId,
          role: "assistant",
          content: aiContent,
        };

        const { error: err1 } = await supabase.from("ai_chat_messages").insert([userMsgPayload]);
        if (err1) console.error("[FoodVision] Error inserting user msg:", err1);

        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay

        const { error: err2 } = await supabase.from("ai_chat_messages").insert([aiMsgPayload]);
        if (err2) console.error("[FoodVision] Error inserting AI msg:", err2);
      }
    }

    // 5. Return results (include llmError for debugging)
    res.json({
      success: true,
      data: {
        ...result,
        imageUrl,
        ...(llmError ? { llmError } : {}),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── POST /api/v1/ai/analyze-lab-report ──────────────────────────────

/**
 * Handles premium GPT-5.2 diagnostic analysis of parsed biomarkers.
 * Produces a structured diagnostic report and saves it to the user's profile.
 */
export async function handleAnalyzeLabReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as AnalyzeLabReportRequest;
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // 1. Fetch user context for personalized analysis
    const dbContext = await fetchUserContext(token, userId);
    const userContext = dbContext
      ? JSON.stringify({
        profile: dbContext.profile,
        recentTests: dbContext.recentTests,
      })
      : "No user context available";

    // 2. Run GPT-5.2 diagnostic analysis
    const report = await runLabReportAnalyzer(
      body.biomarkers,
      userContext,
      userId,
      token,
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── GET /api/v1/ai/lab-reports/history ──────────────────────────────

/**
 * Endpoint to fetch the history of lab diagnostic reports for the user.
 * Returns an array of reports sorted by timestamp descending.
 */
export async function handleGetLabReportsHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("lab_diagnostic_reports")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[GetLabReportsHistory] Error fetching profile:", error);
      throw error;
    }

    let reports = profile?.lab_diagnostic_reports || [];

    // Sort descending by timestamp (newest first)
    if (Array.isArray(reports)) {
      reports = reports.sort((a: any, b: any) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    } else {
      reports = [];
    }

    res.json({ success: true, data: reports });
  } catch (error: unknown) {
    next(error);
  }
}

// ── DELETE /api/v1/ai/lab-reports/history/:timestamp ────────────────

/**
 * Endpoint to delete a specific lab diagnostic report from the user's history.
 */
export async function handleDeleteLabReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { timestamp } = req.params;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!timestamp) {
      res.status(400).json({ success: false, error: "Timestamp is required" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("lab_diagnostic_reports")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[DeleteLabReport] Error fetching profile:", error);
      throw error;
    }

    let reports = Array.isArray((profile as any)?.lab_diagnostic_reports)
      ? (profile as any).lab_diagnostic_reports
      : [];

    const initialLength = reports.length;

    // Filter out the report with the matching timestamp
    reports = reports.filter((r: any) => r.timestamp !== timestamp);

    if (reports.length === initialLength) {
      res.status(404).json({ success: false, error: "Report not found" });
      return;
    }

    // Update the database with the new array
    const { error: updateError } = await supabase
      .from("profiles")
      // @ts-ignore
      .update({ lab_diagnostic_reports: reports })
      .eq("id", userId);

    if (updateError) {
      console.error("[DeleteLabReport] Error updating profile:", updateError);
      throw updateError;
    }

    res.json({ success: true, message: "Report deleted successfully" });
  } catch (error: unknown) {
    next(error);
  }
}

// ── GET /api/v1/ai/somatic-history ──────────────────────────────────────

/**
 * Endpoint to fetch the history of somatic analyses (nails, tongue, skin)
 * Returns the profile.lifestyle_markers.somatic_data object.
 */
export async function handleGetSomaticHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("lifestyle_markers")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[GetSomaticHistory] Error fetching profile:", error);
      throw error;
    }

    // Default to empty object if no data
    const somaticData = profile?.lifestyle_markers?.somatic_data || {};

    res.json({ success: true, data: somaticData });
  } catch (error: unknown) {
    next(error);
  }
}

export async function handleGetNutritionTargets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const dbContext = await fetchUserContext(token, userId);
    if (!dbContext) {
      res.status(500).json({ success: false, error: "Failed to fetch user context" });
      return;
    }

    const { profile, activeKnowledgeBases } = dbContext;

    // Macro fallback
    const macros = profile?.active_nutrition_targets?.macros || {
      calories: 2000,
      protein: 120,
      fat: 60,
      carbs: 250
    };

    // Micro deterministic compute
    const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases);

    res.json({
      success: true,
      data: {
        macros,
        micros,
        rationale
      }
    });
  } catch (error: unknown) {
    next(error);
  }
}

