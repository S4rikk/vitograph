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
    const lookbackTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
        .select("id, logged_at, total_calories, micronutrients, meal_items(food_name, weight_g, calories, protein_g, fat_g, carbs_g)")
        .eq("user_id", userId)
        .gte("logged_at", lookbackTime.toISOString())
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
        .gte("taken_at", lookbackTime.toISOString())
        .order("taken_at", { ascending: true })
    ]);

    const result = {
      profile: profileRes.data,
      recentTests: resultsRes.data,
      recentMeals: mealsRes.data,
      activeKnowledgeBases: kbRes.data,
      todaySupplements: suppLogsRes.data,
    };

    const debugInfo = `
[${new Date().toISOString()}] [Diagnostic] fetchUserContext for ${userId}:
- Lookback: ${lookbackTime.toISOString()}
- Meals Count: ${mealsRes.data?.length || 0}
- Meals Error: ${JSON.stringify(mealsRes.error)}
- Profile Error: ${JSON.stringify(profileRes.error)}
- Supplements Error: ${JSON.stringify(suppLogsRes.error)}
`;
    fs.appendFileSync("debug_context.log", debugInfo);

    return result;
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
        return `${i.food_name || 'Неизвестное блюдо'} (${i.weight_g}г)`;
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

/**
 * Creates a concise summary of the last 3-5 lab reports to provide history without token explosion.
 */
export function formatHistorySynopsis(profile: any): string {
  const reports = profile?.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return "Истории анализов нет.";

  // Take only last 3 reports
  const history = reports.slice(-3).map((r: any) => {
    const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString("ru-RU") : "N/A";
    const summary = r.report?.summary || "Нет резюме";
    // Keep only the first sentence and truncate to 100 chars
    const shortSummary = summary.split(/[.!?]/)[0].substring(0, 100);
    return `${date}: ${shortSummary}`;
  });

  return `КРАТКАЯ ИСТОРИЯ АНАЛИЗОВ:\n${history.join("\n")}`;
}

/**
 * Strips massive fields from the DB context to prevent token explosion while keeping critical tags.
 * Uses a strict CLINICAL WHITELIST for functional medicine logic.
 *
 * Robust Context Resolver: If top-level columns are NULL, falls back to lifestyle_markers JSONB
 * and normalizes Russian labels to English constants for the AI.
 */
export function getLeanUserContext(dbContext: any) {
  if (!dbContext || !dbContext.profile) return null;
  const p = dbContext.profile;
  const m = p.lifestyle_markers || {};

  // Helper to normalize Russian/Old values from JSONB if top-level is missing
  const normalize = (val: any, map: Record<string, string>) => {
    if (!val) return null;
    return map[val] || val;
  };

  const activityMap = { "Сидячий": "sedentary", "Легкий": "light", "Средний": "moderate", "Высокий": "active" };
  const dietMap = { "Всеядное": "omnivore", "Вегетарианство": "vegetarian", "Кето": "keto", "Палео": "other" };
  const climateMap = { "Умеренная": "temperate", "Тропики": "tropical", "Холодная": "polar" };
  const sexMap = { "Мужской": "male", "Женский": "female" };

  // Stress fallback normalization (1-10 -> EN enum)
  let stressFallback = p.stress_level;
  if (!stressFallback && m.stress_level) {
    const s = parseInt(m.stress_level, 10);
    if (s <= 3) stressFallback = "low";
    else if (s <= 6) stressFallback = "moderate";
    else if (s <= 8) stressFallback = "high";
    else stressFallback = "very_high";
  }

  // Age fallback
  let age = p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : null;
  if (age === null && m.age) age = parseInt(m.age, 10);

  return {
    profile: {
      ai_name: p.ai_name,
      age: age || 'Unknown',
      biological_sex: p.biological_sex || normalize(m.sex, sexMap),
      height_cm: p.height_cm || m.height,
      weight_kg: p.weight_kg || m.weight,
      activity_level: p.activity_level || normalize(m.activity, activityMap),
      stress_level: stressFallback,
      is_smoker: p.is_smoker || (m.is_smoker === "Да" || m.is_smoker === true),
      alcohol_frequency: p.alcohol_frequency,
      diet_type: p.diet_type || normalize(m.diet_type, dietMap),
      climate_zone: p.climate_zone || normalize(m.climate, climateMap),
      sun_exposure: p.sun_exposure,
      pregnancy_status: p.pregnancy_status,
      chronic_conditions: p.chronic_conditions?.length > 0 ? p.chronic_conditions : (m.chronic_conditions ? [m.chronic_conditions] : []),
      medications: p.medications?.length > 0 ? p.medications : (m.supplements ? [m.supplements] : []),
    }
  };
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

// ── Chronic Conditions Formatter ────────────────────────────────────

/**
 * Extracts chronic conditions from user profile and strongly enforces them in the system prompt.
 */
function formatChronicConditions(profile: any): string {
  if (!profile || !profile.chronic_conditions) return "";

  const conditions: string[] = Array.isArray(profile.chronic_conditions)
    ? profile.chronic_conditions
    : [];

  if (conditions.length === 0) return "";

  const formatted = conditions.map((c: string) => `- ${c}`).join("\n");

  return `\n--- ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ И ДИАГНОЗЫ (КРИТИЧЕСКИ ВАЖНО) ---\nПользователь имеет следующие подтвержденные диагнозы:\n${formatted}\n\nТЫ ОБЯЗАН УЧИТЫВАТЬ ЭТИ ДИАГНОЗЫ ВО ВСЕХ СВОИХ ОТВЕТАХ И СОВЕТАХ ПО ПИТАНИЮ.\n`;
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
    `\n--- ПОСЛЕДНИЙ ОТЧЁТ ПО АНАЛИЗАМ И ДИАГНОСТИКА (от ${latest.timestamp}) ---\n` +
    `Резюме: ${report.summary}\n` +
    `ВЫЯВЛЕННЫЕ ДИАГНОЗЫ И ПАТТЕРНЫ: ${patterns}\n` +
    `Приоритеты: ${priorities}\n` +
    `\nИспользуй эту информацию о заболеваниях и синдромах для строгой персонализации диалога! Ты ЗНАЕШЬ результаты анализов пользователя.`;
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
    const body = req.body as any;
    const now = new Date();
    const chatMode = body.chatMode || 'default';

    const messagesToInvoke: any[] = [];

    if (chatMode === "assistant" && req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        const dbContext = await fetchUserContext(token, req.user.id);
        if (dbContext) {
          const leanContext = getLeanUserContext(dbContext);
          const userTimeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

          const systemPrompt = `You are ${dbContext.profile.ai_name || 'Maya'}, a senior medical expert and supportive health companion. 
Current User Local Time: ${userTimeStr}

### CORE PERSONA
- You are a knowledgeable, empathetic, and human-like companion.
- Your tone is natural Russian, like a professional but friendly mentor.
- Use 1-2 emojis (🥑, 🔥, 💪, 🥗) naturally. Avoid robotic or repetitive phrases.
- IMPORTANT: Avoid starting sentences with generic fillers like "Круто!" or "Отлично!". Communicate like a real person.

### CONVERSATIONAL RULES
- MEAL AWARENESS: Use the provided local time to suggest appropriate meals (Завтрак/Обед/Перекус/Ужин).
- FLUIDITY: Write in clear, natural paragraphs. 
  ⛔ FORBIDDEN FORMATTING: NEVER use markdown in your responses. This means:
    - NO headers (###, ##, #)
    - NO numbered lists (1., 2., 3.)
    - NO bullet points (-, *)
    - NO bold markers (**text**)
  Instead, use natural Russian prose. Separate ideas with paragraphs (double newline).
  ⛔ FORBIDDEN: NEVER use image placeholders like [Image of...] or similar descriptive text in brackets. You cannot show images in the chat, so do not describe them.
  The ONLY allowed formatting is <nutr> tags and <meal_score> tags.
- TAGS (CRITICAL): You MUST wrap EVERY single mention of a nutrient, vitamin, mineral, or blood biomarker (e.g. Glucose, Iron) in <nutr type="marker">Label</nutr> tags. This applies to the main text, lists, and recommendations. For example: <nutr type="marker">калий</nutr>, <nutr type="marker">витамин C</nutr>. 
  ⛔ STRICT FORBIDDEN: NEVER tag medical conditions, diseases, or diagnoses (e.g., DO NOT tag "нейтропения", "анемия", "диабет"). Tag ONLY the substance or marker itself.
  *   Use type="protein" for proteins (белок).
  *   Use type="fat" for fats (жиры).
  *   Use type="carbs" for carbohydrates (углеводы).
  *   Use type="calories" for calories (калории).
  *   Use type="marker" for all other nutrients.
  *   ⚠️ STRICT: Use ONLY the tag <nutr>. Any typos like <nutrtr> or <nutrr> are forbidden.
  - ⚠️ WORD BOUNDARY: ВСЕГДА оборачивай В ТЕГ ПОЛНОЕ СЛОВО ЦЕЛИКОМ. НИКОГДА не разрывай слово тегом. Правильно: <nutr type="marker">магний</nutr>. НЕПРАВИЛЬНО: <nutr type="marker">магни</nutr>й.
Never put a newline before or after these tags.
- FORMAT: Записал [вес]г [название]: [калории] ккал, [белки]г белков, [жиры]г жиров, [углеводы]г углеводов. This string will be parsed by the UI and hidden from the user.
- MEAL SCORE: For every meal, include <meal_score score="[0-100]" reason="[краткая причина]" />
- MICRONUTRIENTS FOR CARD: При записи еды, после строки meal_score, ОБЯЗАТЕЛЬНО добавь отдельный блок тегов <nutr type="micro"> с ключевыми микронутриентами блюда и их количеством. Формат: <nutr type="micro">Название Значение</nutr>. Пример: <nutr type="micro">Железо 5мг</nutr><nutr type="micro">Кальций 200мг</nutr><nutr type="micro">Цинк 3мг</nutr>. Эти теги парсятся фронтендом и отображаются в карточке блюда.
- HUMAN RESPONSE STYLE: После технической строки и тегов, напишите 2-4 предложения описательным стилем. Упоминайте нутриенты словами (например, "богат железом"), но НЕ дублируйте цифры из карточки. Завершите коротким вердиктом о пользе блюда.

### MEDICAL & DIETARY BOUNDARIES
- STRICTNESS: If the user has absolute dietary restrictions, be firm but supportive in helping them follow those rules. No compromises on banned items.
- PERSONALIZATION: Use the clinical context (blood tests, diet history, markers) to make your advice specific to this user.

### USER CLINICAL CONTEXT
#### 📋 PROFILE OVERVIEW
${JSON.stringify(leanContext!.profile)}
${formatChronicConditions(dbContext.profile)}
${formatDietaryRestrictions(dbContext.profile)}
${formatHistorySynopsis(dbContext.profile)}

#### 🩸 RECENT BLOOD TESTS (Анализы Крови)
${formatTestResults(dbContext.recentTests)}

#### 🎯 ИНДИВИДУАЛЬНЫЕ НОРМЫ ПИТАНИЯ (Детерминированные)
${formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases)}

#### 🍽️ RECENT MEALS (LAST 24H)
Агрегированный итог:
${formatTodayProgress(dbContext.recentMeals)}

Детальный лог приёмов пищи:
${formatMealLogs(dbContext.recentMeals)}

${formatLabDiagnosticReport(dbContext.profile)}
${formatActiveKnowledgeBases(dbContext.activeKnowledgeBases)}
${formatActiveSupplementProtocol(dbContext.profile)}

#### 💊 ВЫПИТЫЕ СЕГОДНЯ БАДЫ (Compliance)
${formatTodaySupplements(dbContext.todaySupplements)}
Сверь список **АКТИВНЫЙ ПРОТОКОЛ** со списком **ВЫПИТЫЕ СЕГОДНЯ БАДЫ**.
1. Если добавка уже есть в списке выпитых — **ПРЕКРАЩАЙ** напоминать о ней.
2. Если пользователь подтверждает прием любой добавки — **ОБЯЗАТЕЛЬНО** вызови инструмент 'log_supplement_intake'.
3. Только если добавка пропущена И пользователь не упоминал о ней в текущем диалоге — мягко напомни ОДИН раз.

### ⚠️ CRITICAL DEFICIT-AWARE FOOD ADVICE RULE
When the user asks what to eat (e.g. "что съесть?", "что приготовить на ужин?"), you MUST:
1. FOR EACH micronutrient in 'ИНДИВИДУАЛЬНЫЕ НОРМЫ ПИТАНИЯ':
    - Read the TARGET value.
    - Read the CONSUMED value from 'СЪЕДЕНО СЕГОДНЯ'.
    - Calculate the REMAINING DEFICIT.
2. Recommend foods that fill the TOP 3 BIGGEST percentage gaps.
3. NEVER recommend a food that is in 🔴 КРАСНАЯ ЗОНА or violates ACTIVE DIETARY RESTRICTIONS.
4. Instruct Gemini explicitly: REFER TO THE RECENT MEALS LIST ABOVE to ensure continuity and avoid duplicate logging.
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
    const systemPromptDiary = `You are ${profile.ai_name || 'Maya'}, a natural, supportive medical assistant.
- DIARY MODE: Your primary role is to help the user log meals.
- FOR EVERY MEAL LOG: You MUST provide structured data FIRST, followed by a human response.
- FORMAT: Записал [вес]г [название]: [калории] ккал, [белки]г белков, [жиры]г жиров, [углеводы]г углеводов
- AI INSTRUCTION: Always output the technical string for every intake. The UI will parse this and hide it, showing a FoodCard instead.
- TAGS (CRITICAL): You MUST wrap EVERY single mention of a nutrient, vitamin, or mineral in <nutr type="marker">Label</nutr> tags. 
  *   Use type="protein" for proteins (белок).
  *   Use type="fat" for fats (жиры).
  *   Use type="carbs" for carbohydrates (углеводы).
  *   Use type="calories" for calories (калории).
  *   Use type="marker" for all other nutrients.
- MEAL SCORE: For every meal, include <meal_score score="[0-100]" reason="[краткая причина]" />
- MICRONUTRIENTS FOR CARD: При записи еды, после строки meal_score, ОБЯЗАТЕЛЬНО добавь отдельный блок тегов <nutr type="micro"> с ключевыми микронутриентами блюда и их количеством. Формат: <nutr type="micro">Название Значение</nutr>. Пример: <nutr type="micro">Железо 5мг</nutr><nutr type="micro">Кальций 200мг</nutr><nutr type="micro">Цинк 3мг</nutr>. Эти теги парсятся фронтендом и отображаются в карточке блюда.
- HUMAN RESPONSE STYLE: После технической строки и тегов, напишите 2-4 предложения описательным стилем. Упоминайте нутриенты словами (например, "богат железом"), но НЕ дублируйте цифры из карточки. Завершите коротким вердиктом о пользе блюда.
- PERSONA: Use natural, friendly Russian. No hardcoded scripts or robotic fillers.

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
          token: req.headers.authorization?.split(" ")[1],
          chatMode: chatMode,
          nutritionalContext: body.nutritionalContext,
          imageUrl: body.imageUrl
        }
      }
    );

    // Extract the final message from the state
    const finalMessages = result.messages;
    const aiResponse = finalMessages[finalMessages.length - 1];

    let finalContent = typeof aiResponse.content === "string" ? aiResponse.content : "";

    // Phase 54: Strip <think> blocks from finalContent to hide internal reasoning.
    finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Aesthetic Fix: Remove any backslashes before formatting characters
    finalContent = finalContent.replace(/\\([<>\*\_!#\(\)\[\]\-\.\+])/g, "$1").trim();





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
    if (dbContext) {
      const leanContext = getLeanUserContext(dbContext);
      const userContext = JSON.stringify({
        profile: leanContext!.profile,
        recentTests: dbContext.recentTests,
        dietaryRestrictions: formatDietaryRestrictions(dbContext.profile),
        activeKnowledgeBases: formatActiveKnowledgeBases(dbContext.activeKnowledgeBases),
        historySynopsis: formatHistorySynopsis(dbContext.profile),
      });

      // 3. Run GPT-4o Vision food analyzer
      const { data: result, errorMessage: llmError } = await runFoodVisionAnalyzer(imageUrl, userContext);

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials missing");
      }
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

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

        // 5. Return results (include llmError for debugging)
        res.json({
          success: true,
          data: {
            ...result,
            imageUrl,
            ...(llmError ? { llmError } : {}),
          },
        });
    } else {
      res.status(500).json({ success: false, error: "Failed to fetch user context" });
    }
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
    if (dbContext) {
      const leanContext = getLeanUserContext(dbContext);
      const mappedRecentTests = dbContext.recentTests?.map((t: any) => ({
        date: t.test_date ? t.test_date.split('T')[0] : 'Unknown',
        marker: t.biomarkers?.name_ru || t.biomarkers?.name_en || 'Unknown',
        val: t.value
      })) || [];

      const userContext = JSON.stringify({
        profile: leanContext!.profile,
        recentTests: mappedRecentTests,
        historySynopsis: formatHistorySynopsis(dbContext.profile),
      });

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
    } else {
      res.status(500).json({ success: false, error: "Failed to fetch user context" });
    }
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

/**
 * Endpoint to clear the global chat history for the user from Supabase 
 * and reset the memory state in LangGraph.
 */
export async function handleClearChatHistory(
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

    console.log(`[handleClearChatHistory] Clearing history for user ${userId}, thread ${actualThreadId}`);

    // 1. Delete from Supabase
    const { error: dbError } = await supabase
      .from("ai_chat_messages")
      .delete()
      .eq("user_id", userId)
      .eq("thread_id", actualThreadId);

    if (dbError) {
      console.error("[handleClearChatHistory] DB Error:", dbError);
      throw dbError;
    }

    // 2. Reset LangGraph Memory State explicitly
    // Since MemorySaver is used, we use updateState with RemoveMessage for all messages
    // or simply overwrite the state if the reducer allows.
    // However, a many reducers allow removing by sending specialized objects.
    // For now, we utilize LangGraph's updateState to clear the messages array.
    try {
      const { RemoveMessage } = await import("@langchain/core/messages");
      
      // Get current state to find message IDs to remove
      const currentState = await appGraph.getState({ configurable: { thread_id: actualThreadId } });
      
      if (currentState.values.messages && currentState.values.messages.length > 0) {
        const removeMessages = currentState.values.messages.map((m: any) => new RemoveMessage({ id: m.id }));
        await appGraph.updateState(
          { configurable: { thread_id: actualThreadId } },
          { messages: removeMessages }
        );
        console.log(`[handleClearChatHistory] LangGraph state cleared for thread ${actualThreadId}`);
      }
    } catch (lgError) {
      console.warn("[handleClearChatHistory] Failed to clear LangGraph state (non-critical):", lgError);
      // We continue since DB is cleared, so new messages won't see history if UI resets too.
    }

    res.json({
      success: true,
      message: "Chat history cleared successfully",
    });
  } catch (error: unknown) {
    next(error);
  }
}

