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
import { runLabelScanner } from "./graph/label-scanner.js";
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
  AnalyzeLabelRequest,
} from "./request-schemas.js";

import { HumanMessage, SystemMessage, isAIMessageChunk } from "@langchain/core/messages";
import { appGraph } from "./graph/builder.js";
import { getOrFetchWeatherContext } from "./weather.service.js";
import { fetchAdvancedMemoryContext } from "./services/memory.service.js";
import { fetchActiveSkills, fetchMatchingSkillDocument } from "./services/skills.service.js";
import { fetchKnowledgeBaseContext } from "./services/kb.service.js";
import { callLlmStructured, LLM_TIMEOUTS, LLM_RETRIES } from "./llm-client.js";
import { z } from "zod";

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
  somaticData?: any
): { micros: Record<string, number>; rationale: string } {
  const micros = { ...BACKEND_BASE_MICRO_TARGETS };
  const factors: string[] = [];
  let currentChanges: string[] = [];

  const applyMod = (key: string, mult: number) => {
    if (micros[key] !== undefined && mult !== 1) {
      micros[key] *= mult;
      const pct = Math.round((mult - 1) * 100);
      const sign = pct > 0 ? "↑" : "↓";
      currentChanges.push(`${key} ${sign}${Math.abs(pct)}%`);
    }
  };

  const commitFactor = (reasonName: string) => {
    if (currentChanges.length > 0) {
      factors.push(`${reasonName} (${currentChanges.join(', ')})`);
      currentChanges = []; // reset for the next factor
    } else {
      factors.push(reasonName);
    }
  };

  if (!profile) return { micros, rationale: 'Профиль не загружен.' };

  // LAYER 0: Diagnosis-driven
  if (activeKnowledgeBases && activeKnowledgeBases.length > 0) {
    // Deduplicate by condition name
    const uniqueKbsMap = new Map();
    activeKnowledgeBases.forEach(kb => {
      if (!uniqueKbsMap.has(kb.condition_name)) {
        uniqueKbsMap.set(kb.condition_name, kb);
      }
    });
    const uniqueKbs = Array.from(uniqueKbsMap.values());

    uniqueKbs.forEach((diag: any) => {
      const kb = diag.knowledge_data;
      if (!kb) return;
      const sevMult = BACKEND_SEVERITY_MULT[diag.severity] || 1.15;
      if (Array.isArray(kb.cofactors)) {
        kb.cofactors.forEach((c: string) => {
          const nk = BACKEND_COFACTOR_MAP[c];
          if (nk && micros[nk] !== undefined) {
            applyMod(nk, sevMult);
          }
        });
      }
      if (currentChanges.length > 0) {
        commitFactor(`⚕️ ${diag.condition_name} [${diag.severity}]`);
      }
    });
  }

  // LAYER 0b: Lab reports
  if (profile.lab_diagnostic_reports && Array.isArray(profile.lab_diagnostic_reports)) {
    const latest = profile.lab_diagnostic_reports[profile.lab_diagnostic_reports.length - 1];
    if (latest?.report?.biomarker_assessments) {
      const anomalous = latest.report.biomarker_assessments.filter(
        (b: any) => b.status === 'low' || b.status === 'critical_low'
      );
      anomalous.forEach((bm: any) => {
        const nk = BACKEND_COFACTOR_MAP[bm.name];
        if (nk && micros[nk] !== undefined) {
          const mult = bm.status === 'critical_low' ? 1.50 : 1.25;
          applyMod(nk, mult);
        }
      });
      if (currentChanges.length > 0) {
        commitFactor(`🔬 Дефицит по анализам`);
      }
    }
  }

  // LAYER 0c: Соматические Маркеры
  if (somaticData) {
    if (Array.isArray(somaticData.nails)) {
      somaticData.nails.forEach((marker: string) => {
        if (marker.includes("Koilonychia") || marker.includes("Pale nail bed") || marker.includes("Terry's nails")) {
          applyMod('Железо', 1.25);
          commitFactor("💅 Ногти: дефицит железа");
        } else if (marker.includes("Leukonychia")) {
          applyMod('Цинк', 1.20);
          commitFactor("💅 Ногти: дефицит цинка");
        } else if (marker.includes("Longitudinal striations")) {
          applyMod('Железо', 1.20);
          applyMod('Витамин B12', 1.20);
          commitFactor("💅 Ногти: дефицит железа/B12");
        } else if (marker.includes("Onychorrhexis")) {
          applyMod('Кальций', 1.15);
          commitFactor("💅 Ногти: дефицит кальция");
        }
      });
    }

    if (Array.isArray(somaticData.tongue)) {
      somaticData.tongue.forEach((marker: string) => {
        if (marker.includes("Отпечатки зубов по краям")) {
          applyMod('Йод', 1.15);
          commitFactor("👅 Язык: дефицит йода");
        } else if (marker.includes("Трещины/бороздки")) {
          applyMod('Витамин B12', 1.20);
          applyMod('Витамин B6', 1.20);
          commitFactor("👅 Язык: дефицит B-витаминов");
        } else if (marker.includes("Бледность")) {
          applyMod('Железо', 1.25);
          commitFactor("👅 Язык: дефицит железа");
        }
      });
    }

    if (Array.isArray(somaticData.skin)) {
      somaticData.skin.forEach((marker: string) => {
        if (marker.includes("Акне/высыпания")) {
          applyMod('Цинк', 1.20);
          applyMod('Витамин A', 1.20);
          commitFactor("✨ Кожа: дефицит цинка/вит А");
        } else if (marker.includes("Бледность")) {
          applyMod('Железо', 1.20);
          commitFactor("✨ Кожа: дефицит железа");
        } else if (marker.includes("Сухость/шелушение")) {
          applyMod('Омега-3', 1.30);
          commitFactor("✨ Кожа: дефицит омега-3");
        }
      });
    }
  }

  // LAYERS 1-9: Profile modifiers
  if (profile.diet_type === 'vegan') {
    applyMod('Железо', 1.80); applyMod('Витамин B12', 2.00); applyMod('Цинк', 1.50);
    applyMod('Кальций', 1.20); applyMod('Витамин D', 1.30); applyMod('Омега-3', 1.50);
    applyMod('Витамин A', 1.40); applyMod('Йод', 1.20);
    commitFactor('Веган');
  } else if (profile.diet_type === 'vegetarian') {
    applyMod('Железо', 1.50); applyMod('Витамин B12', 1.50); applyMod('Цинк', 1.25);
    applyMod('Кальций', 1.10); applyMod('Витамин D', 1.20); applyMod('Омега-3', 1.30);
    commitFactor('Вегетарианец');
  } else if (profile.diet_type === 'keto') {
    applyMod('Витамин C', 1.30); applyMod('Натрий', 1.40);
    commitFactor('Кето');
  }

  if (profile.activity_level === 'moderate') {
    applyMod('Магний', 1.10); applyMod('Калий', 1.10); applyMod('Витамин B6', 1.10);
    applyMod('Железо', 1.05); applyMod('Натрий', 1.10);
    currentChanges = [];
  } else if (profile.activity_level === 'active') {
    applyMod('Магний', 1.15); applyMod('Калий', 1.15); applyMod('Витамин B6', 1.15);
    applyMod('Железо', 1.10); applyMod('Натрий', 1.15);
    commitFactor('Высокая активность');
  } else if (profile.activity_level === 'very_active') {
    applyMod('Магний', 1.25); applyMod('Калий', 1.25); applyMod('Витамин B6', 1.20);
    applyMod('Железо', 1.15); applyMod('Натрий', 1.20); applyMod('Витамин E', 1.10);
    commitFactor('Очень высокая активность');
  }

  if (profile.stress_level === 'moderate') {
    applyMod('Витамин C', 1.10); applyMod('Магний', 1.10);
    currentChanges = [];
  } else if (profile.stress_level === 'high') {
    applyMod('Витамин C', 1.30); applyMod('Магний', 1.20); applyMod('Витамин B6', 1.15);
    applyMod('Витамин B12', 1.10);
    commitFactor('Высокий стресс');
  } else if (profile.stress_level === 'very_high') {
    applyMod('Витамин C', 1.50); applyMod('Магний', 1.30); applyMod('Витамин B6', 1.25);
    applyMod('Витамин B12', 1.20);
    commitFactor('Очень высокий стресс');
  }

  if (profile.sun_exposure === 'minimal') {
    applyMod('Витамин D', 1.60); commitFactor('Мало солнца');
  } else if (profile.sun_exposure === 'moderate') {
    applyMod('Витамин D', 1.20);
    currentChanges = [];
  }

  if (profile.climate_zone === 'polar') {
    applyMod('Витамин D', 1.50); applyMod('Витамин C', 1.20); applyMod('Йод', 1.10);
    commitFactor('Полярный климат');
  } else if (profile.climate_zone === 'continental') {
    applyMod('Витамин D', 1.30); applyMod('Витамин C', 1.10);
    currentChanges = [];
  } else if (profile.climate_zone === 'temperate') {
    applyMod('Витамин D', 1.20);
    currentChanges = [];
  }

  if (profile.is_smoker) {
    applyMod('Витамин C', 1.80); applyMod('Витамин E', 1.30);
    applyMod('Селен', 1.20); applyMod('Фолиевая кислота', 1.25);
    commitFactor('Курение');
  }

  if (profile.alcohol_frequency === 'moderate') {
    applyMod('Витамин B12', 1.15); applyMod('Фолиевая кислота', 1.15);
    applyMod('Магний', 1.10); applyMod('Цинк', 1.10);
    currentChanges = [];
  } else if (profile.alcohol_frequency === 'heavy') {
    applyMod('Витамин B12', 1.30); applyMod('Фолиевая кислота', 1.30);
    applyMod('Магний', 1.20); applyMod('Цинк', 1.20);
    commitFactor('Частый алкоголь');
  }

  if (profile.pregnancy_status === 'pregnant') {
    applyMod('Фолиевая кислота', 1.50); applyMod('Железо', 1.80); applyMod('Кальций', 1.30);
    applyMod('Витамин D', 1.30); applyMod('Йод', 1.50); applyMod('Омега-3', 1.50);
    commitFactor('Беременность');
  } else if (profile.pregnancy_status === 'breastfeeding') {
    applyMod('Фолиевая кислота', 1.25); applyMod('Железо', 1.20); applyMod('Кальций', 1.20);
    applyMod('Витамин D', 1.20); applyMod('Йод', 1.60); applyMod('Омега-3', 1.30);
    commitFactor('Грудное вскармливание');
  }

  if (profile.biological_sex === 'female') {
    applyMod('Железо', 1.20); commitFactor('Жен. пол');
  }

  for (const key of Object.keys(micros)) micros[key] = Number(micros[key].toFixed(1));

  const rationale = factors.length > 0
    ? `Индивидуальные нормы (${factors.join(', ')}).`
    : 'Базовая норма.';

  return { micros, rationale };
}

function computeDeterministicMacros(profile: any): { calories: number; protein: number; fat: number; carbs: number; } {
  // 1. Fallback base
  const base = { calories: 2000, protein: 120, fat: 60, carbs: 250 };
  if (!profile || !profile.weight_kg || !profile.height_cm || !profile.date_of_birth) return base;

  // 2. Parse basic metrics
  const weight = profile.weight_kg;
  const height = profile.height_cm;
  const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();
  const isFemale = profile.biological_sex === 'female';

  // 3. Mifflin-St Jeor BMR
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = isFemale ? (bmr - 161) : (bmr + 5);

  // 4. Activity Multiplier (TDEE)
  const activityMap: Record<string, number> = {
    'sedentary': 1.2,
    'light_active': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
  };
  const multiplier = activityMap[profile.activity_level] || 1.2;

  let tdee = Math.round(bmr * multiplier);

  // 5. Diet Goal / Type modifier (Optional basic modifiers, default is maintenance)
  // Example: if profile has a goal, we could add/subtract. For now, maintenance:

  // 6. Macro Split
  // Protein: ~1.8g per kg
  const protein = Math.round(weight * 1.8);
  // Fat: ~1.0g per kg
  const fat = Math.round(weight * 1.0);

  // Carbs: The rest of the calories
  // (Protein=4kcal/g, Fat=9kcal/g, Carbs=4kcal/g)
  const remainingCalories = tdee - (protein * 4) - (fat * 9);
  const carbs = Math.max(0, Math.round(remainingCalories / 4));

  return {
    calories: tdee,
    protein,
    fat,
    carbs
  };
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
      somaticData: profileRes.data?.lifestyle_markers?.somatic_data || null,
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

function formatTestResults(tests: any[] | null, timezone: string = "UTC", profile?: any): string {
  if (!tests || tests.length === 0) {
    // Check if lab reports exist in JSONB profile field
    const hasLabReports = profile?.lab_diagnostic_reports && Array.isArray(profile.lab_diagnostic_reports) && profile.lab_diagnostic_reports.length > 0;
    if (hasLabReports) {
      return `У пользователя есть загруженные отчёты по анализам крови (см. блок ОТЧЁТ ПО АНАЛИЗАМ ниже). ⛔ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО говорить пользователю "перейдите в раздел Анализы" или "загрузите анализы". Данные УЖЕ загружены и доступны тебе.`;
    }
    return `Нет загруженных анализов.
⚠️ ИНСТРУКЦИЯ ДЛЯ ИИ ПРО АНАЛИЗЫ: Если пользователь хочет обсудить анализы, НЕМЕДЛЕННО скажи ему: "Пожалуйста, перейдите в раздел 'Анализы' и загрузите фото или PDF ваших бланков, чтобы я мог их изучить." Категорически НЕ предлагай никаких иных способов загрузки.`;
  }

  return tests.map(t => {
    const name = t.biomarkers?.name_ru || t.biomarkers?.name_en || "Неизвестный маркер";
    const date = new Date(t.test_date).toLocaleDateString("ru-RU", { timeZone: timezone });
    return `- [${date}] ${name}: ${t.value} ${t.unit}`;
  }).join("\n");
}

function formatMealLogs(meals: any[] | null, timezone: string = "UTC"): string {
  if (!meals || meals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });

  const todayMeals = meals.filter(m => {
    const mealDate = new Date(m.logged_at);
    return mealDate.toLocaleDateString("en-CA", { timeZone: timezone }) === todayDateStr;
  });

  if (todayMeals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  return todayMeals.map(m => {
    const mealDate = new Date(m.logged_at);
    const dayLabel = "Сегодня";

    const time = mealDate.toLocaleTimeString("ru-RU", {
      hour: '2-digit', minute: '2-digit', timeZone: timezone
    });

    let text = `- [${dayLabel}, ${time}]`;
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
export function formatHistorySynopsis(profile: any, timezone: string = "UTC"): string {
  const reports = profile?.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return "Истории анализов нет.";

  // Take only last 3 reports
  const history = reports.slice(-3).map((r: any) => {
    const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString("ru-RU", { timeZone: timezone }) : "N/A";
    const summary = r.report?.summary || "Нет резюме";
    // Keep only the first sentence and truncate to 100 chars
    const shortSummary = summary.split(/[.!?]/)[0].substring(0, 100);
    return `${date}: ${shortSummary}`;
  });

  return `КРАТКАЯ ИСТОРИЯ АНАЛИЗОВ:\n${history.join("\n")}`;
}

function formatLeanProfile(profile: any): string {
  if (!profile) return "Нет данных о профиле.";
  const age = profile.age || 'Н/Д';
  const sex = profile.sex === 'male' ? 'Мужчина' : profile.sex === 'female' ? 'Женщина' : 'Н/Д';
  const height = profile.height_cm ? `${profile.height_cm} см` : 'Н/Д';
  const weight = profile.weight_kg ? `${profile.weight_kg} кг` : 'Н/Д';
  const activity = profile.activity_level || 'Н/Д';
  const diet = profile.diet_type || 'Н/Д';
  const smoker = profile.is_smoker ? 'Да' : 'Нет';

  return `Пользователь: Возраст: ${age}, Пол: ${sex}, Рост: ${height}, Вес: ${weight}. Активность: ${activity}. Диета: ${diet}. Курит: ${smoker}.`;
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
function formatNutritionTargets(profile: any, activeKnowledgeBases: any[] | null, somaticData?: any): string {
  const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases, somaticData);

  let text = `${rationale}\n`;

  const macros = computeDeterministicMacros(profile);
  text += `Макросы: Ккал=${macros.calories}, Белки=${macros.protein}г, Жиры=${macros.fat}г, Углеводы=${macros.carbs}г\n`;

  const microEntries = Object.entries(micros).map(([k, v]) => `${k}: ${v}`).join(", ");
  text += `Микронутриенты: ${microEntries}\n`;

  return text;
}

/**
 * Aggregates today's consumed nutrients from meal_logs into a summary for deficit calculation.
 */
function formatTodayProgress(meals: any[] | null, timezone: string = "UTC"): string {
  if (!meals || meals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });

  const todayMeals = (meals || []).filter(m => {
    const mealDate = new Date(m.logged_at);
    return mealDate.toLocaleDateString("en-CA", { timeZone: timezone }) === todayDateStr;
  });

  if (todayMeals.length === 0) return "Сегодня пользователь ещё ничего не ел.";

  let totalCal = 0, totalP = 0, totalF = 0, totalC = 0;
  const microTotals: Record<string, number> = {};

  for (const m of todayMeals) {
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
  text += `Приёмов пищи: ${todayMeals.length}\n`;

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

  // Deduplicate by condition name (keep the first occurrence)
  const uniqueKbsMap = new Map();
  kbs.forEach(kb => {
    if (!uniqueKbsMap.has(kb.condition_name)) {
      uniqueKbsMap.set(kb.condition_name, kb);
    }
  });

  // Convert back to array and limit to top 10 unique conditions to prevent bloat
  const uniqueKbs = Array.from(uniqueKbsMap.values()).slice(0, 10);

  let kbContext = `\n--- АКТИВНЫЕ ДИАГНОЗЫ И БАЗЫ ЗНАНИЙ (Phase 49) ---\n`;
  kbContext += `Пользователь в данный момент имеет следующие активные клинические паттерны. ИСПОЛЬЗУЙ ЭТИ ДАННЫЕ для корректировки питания и образа жизни:\n\n`;

  uniqueKbs.forEach((kb) => {
    const data = kb.knowledge_data;
    if (!data) return;

    kbContext += `- ${kb.condition_name}. `;
    if (data.cofactors && data.cofactors.length > 0) kbContext += `Нужны: ${data.cofactors.join(", ")}. `;
    if (data.inhibitors && data.inhibitors.length > 0) kbContext += `Избегать: ${data.inhibitors.join(", ")}. `;
    if (data.lifestyle_rules && data.lifestyle_rules.length > 0) kbContext += `Правила: ${data.lifestyle_rules.join("; ")}.\n`;
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

function formatTodaySupplements(logs: any[] | null, timezone: string = "UTC"): string {
  if (!logs || logs.length === 0) return "Сегодня пользователь еще не отмечал прием БАДов.";

  return logs.map(l => {
    const time = new Date(l.taken_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    const status = l.was_on_time ? "✅ Вовремя" : "⚠️ С опозданием / Не по графику";
    return `- [${time}] ${l.supplement_name} (${l.dosage_taken}) — ${status}`;
  }).join("\n");
}

// ── Lab Diagnostic Report Formatter ───────────────────────────────────

function formatFoodContraindicationZones(profile: any): string {
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
  return baseContext;
}

/**
 * Extracts the latest lab diagnostic report from the profile
 * and formats it as a context block for the chat system prompt.
 */
function formatLabDiagnosticReport(profile: any): string {
  if (!profile) return "";

  const reports = profile.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return "";

  const latest = reports[reports.length - 1];
  const report = latest.report;
  if (!report) return "";

  const patterns = report.diagnostic_patterns
    ?.map((p: any) => p.pattern_name)
    .join(", ") || "Нет";

  const priorities = report.priority_actions
    ?.map((a: any) => `[${a.priority}] ${a.action}`)
    .join("; ") || "Нет";

  const dietaryRecs = report.dietary_recommendations
    ?.map((d: any) => `- ${d.recommendation} (Целевые маркеры: ${d.target_markers?.join(', ') || 'N/A'})`)
    .join("\n") || "Нет";

  const additionalTests = report.recommended_additional_tests
    ?.map((t: any) => `- ${t.test_name}: ${t.reason}`)
    .join("\n") || "Нет";

  // Always include anomalous biomarkers in Tier 1 (typically 3-5 items)
  const anomalousMarkers = (report.biomarker_assessments || [])
    .filter((bm: any) => bm.status !== 'normal')
    .map((bm: any) => {
      const icons: Record<string, string> = { 'critical_low': '🔴', 'low': '🟡', 'high': '🟡', 'critical_high': '🔴' };
      return `- ${icons[bm.status] || '⚠️'} [${bm.status}] ${bm.name}: ${bm.value} ${bm.unit} (норма: ${bm.reference_range}). ${bm.clinical_significance}`;
    })
    .join("\n");

  return `\n--- ПОСЛЕДНИЙ ОТЧЁТ ПО АНАЛИЗАМ И ДИАГНОСТИКА (от ${latest.timestamp}) ---\n` +
    `Резюме: ${report.summary}\n` +
    `ВЫЯВЛЕННЫЕ ДИАГНОЗЫ И ПАТТЕРНЫ: ${patterns}\n` +
    `Приоритеты: ${priorities}\n` +
    (anomalousMarkers ? `\nПРОБЛЕМНЫЕ ПОКАЗАТЕЛИ (ОТКЛОНЕНИЯ):\n${anomalousMarkers}\n` : '') +
    `\nРекомендации по питанию:\n${dietaryRecs}\n` +
    `Рекомендуемые дополнительные обследования:\n${additionalTests}\n` +
    `\nИспользуй эту информацию о заболеваниях и синдромах для строгой персонализации диалога! Ты ЗНАЕШЬ результаты анализов пользователя. У тебя есть ВСЕ данные, НИКОГДА НЕ ГОВОРИ пользователю "загрузите анализы" или "перейдите в раздел Анализы". Если данные выше присутствуют — ты УЖЕ видишь их анализы.\n\n` +
    `⚠️ CLEAN SLATE RULE: If the PROFILE OVERVIEW and BLOOD TESTS sections are EMPTY, you MUST NOT reference any past medical diagnoses (e.g., neutropenia) from memory. Assume the user is starting fresh and healthy unless data is currently present.`;
}

/**
 * Deep lab report formatter — includes FULL biomarker_assessments for detailed user questions.
 * Used when the user explicitly asks about their lab results.
 */
function formatLabReportDeep(profile: any): string {
  // Start with the Tier 1 output (recommendations)
  let base = formatLabDiagnosticReport(profile);

  const reports = profile?.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return base;

  const latest = reports[reports.length - 1];
  const report = latest?.report;
  if (!report || !report.biomarker_assessments) return base;

  const statusIcons: Record<string, string> = {
    'critical_low': '🔴', 'low': '🟡', 'normal': '✅', 'high': '🟡', 'critical_high': '🔴'
  };

  const assessments = report.biomarker_assessments.map((bm: any) => {
    const icon = statusIcons[bm.status] || '❓';
    return `- ${icon} [${bm.status}] ${bm.name}: ${bm.value} ${bm.unit} (норма: ${bm.reference_range}). ${bm.clinical_significance}`;
  }).join("\n");

  base += `\n\n--- ДЕТАЛЬНАЯ РАСШИФРОВКА ВСЕХ ПОКАЗАТЕЛЕЙ (по запросу пользователя) ---\n`;
  base += `${assessments}\n`;
  base += `\nТы ОБЯЗАН использовать эти точные числа при ответе пользователю. НИКОГДА не говори "я не могу посмотреть ваши анализы".\n`;

  return base;
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

// ── PATCH /api/v1/ai/meal-log/:id ───────────────────────────────────

export async function handleUpdateMealLog(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];
    const { id: mealLogId } = req.params;
    const { new_weight_g } = req.body;

    if (!userId || !token) throw new Error("Unauthorized");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error("Supabase internal configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[handleUpdateMealLog] Debug:", { mealLogId, userId, hasToken: !!token });

    // 1. Fetch current meal log to get original weight and macros
    // Diagnostic: Fetch without user_id filter first to see if it even exists
    const { data: log, error: fetchError } = await supabase
      .from("meal_logs")
      .select("*, meal_items(*)")
      .eq("id", mealLogId)
      .single();

    if (fetchError) {
      console.error("[handleUpdateMealLog] Fetch Error:", fetchError);
      throw new Error(`Meal log fetch failed: ${fetchError.message}`);
    }

    if (!log) {
      console.error("[handleUpdateMealLog] Log not found for ID:", mealLogId);
      throw new Error("Meal log not found");
    }

    // 2. Verify ownership in code
    if (log.user_id !== userId) {
      console.error("[handleUpdateMealLog] Access Denied. Owner:", log.user_id, "Requestor:", userId);
      throw new Error("Access denied: You do not own this meal log");
    }

    // We assume there's at least one item. If multiple, we scale all proportionately.
    // For now, most logs have 1 main item from the assistant.
    const items = log.meal_items || [];
    const oldWeight = items.reduce((sum: number, i: any) => sum + (i.weight_g || 0), 0) || 1;
    const ratio = new_weight_g / oldWeight;

    // 2. Scale Macros
    const updatedMacros = {
      total_calories: Number((log.total_calories * ratio).toFixed(1)),
      total_protein: Number((log.total_protein * ratio).toFixed(1)),
      total_fat: Number((log.total_fat * ratio).toFixed(1)),
      total_carbs: Number((log.total_carbs * ratio).toFixed(1)),
    };

    // 3. Scale Micros
    const updatedMicros: Record<string, number> = {};
    if (log.micronutrients && typeof log.micronutrients === 'object') {
      Object.entries(log.micronutrients).forEach(([k, v]) => {
        if (typeof v === 'number') {
          updatedMicros[k] = Number((v * ratio).toFixed(1));
        }
      });
    }

    // 4. Update Database
    const { error: updateLogError } = await supabase
      .from("meal_logs")
      .update({
        ...updatedMacros,
        micronutrients: updatedMicros
      })
      .eq("id", mealLogId);

    if (updateLogError) throw updateLogError;

    // 5. Update Chat Message Content (Sync) - Use Admin to bypass RLS
    const { data: messages, error: msgFetchError } = await supabaseAdmin
      .from("ai_chat_messages")
      .select("*")
      .eq("user_id", userId)
      .ilike("content", `%<meal_id id="${mealLogId}"%`);

    if (!msgFetchError && messages && messages.length > 0) {
      for (const msg of messages) {
        let newContent = msg.content;

        // 5a. Atomic Reconstruction of the Macro Line
        const foodName = items[0]?.food_name || 'Блюдо';
        const newMacroLine = `Записал ${Math.round(new_weight_g)}г ${foodName}: ${Math.round(updatedMacros.total_calories)} ккал, ${updatedMacros.total_protein.toFixed(1)}г белков, ${updatedMacros.total_fat.toFixed(1)}г жиров, ${updatedMacros.total_carbs.toFixed(1)}г углеводов`;

        // Replace the entire block from "Записал" to "углеводов"
        newContent = newContent.replace(/Записал[\s\S]*?углеводов/g, newMacroLine);

        // 5b. Atomic Reconstruction of Micros
        // Remove old micro tags first to avoid duplicates or orphans
        newContent = newContent.replace(/<nutr type="micro">[\s\S]*?<\/nutr>/g, "").trim();

        // Build new tags
        const microTags = Object.entries(updatedMicros)
          .map(([k, v]) => {
            const nameOnly = k.split(' (')[0];
            const unit = k.match(/\((.*?)\)/)?.[1] || 'г';
            return `<nutr type="micro">${nameOnly} (${v}${unit})</nutr>`;
          })
          .join(' ');

        // Insert new tags after <meal_score ... />
        if (newContent.includes('</meal_score>')) {
          newContent = newContent.replace('</meal_score>', `</meal_score>\n${microTags}`);
        } else if (newContent.includes('/>')) {
          // Fallback for self-closing meal_score
          newContent = newContent.replace(/<meal_score[\s\S]*?\/>/, (match: string) => `${match}\n${microTags}`);
        } else {
          // Fallback: just append if no tag found
          newContent += `\n${microTags}`;
        }

        // Clean up double newlines
        newContent = newContent.replace(/\n\n+/g, "\n\n").trim();

        await supabaseAdmin
          .from("ai_chat_messages")
          .update({ content: newContent })
          .eq("id", msg.id);
      }
    }


    // 6. Update items as well - Use Admin for consistency
    for (const item of items) {
      const itemRatio = new_weight_g / oldWeight;
      await supabaseAdmin.from("meal_items").update({
        weight_g: Number((item.weight_g * itemRatio).toFixed(1)),
        calories: Number((item.calories * itemRatio).toFixed(1)),
        protein_g: Number((item.protein_g * itemRatio).toFixed(1)),
        fat_g: Number((item.fat_g * itemRatio).toFixed(1)),
        carbs_g: Number((item.carbs_g * itemRatio).toFixed(1)),
      }).eq("id", item.id);
    }

    res.json({ success: true, data: { id: mealLogId, ...updatedMacros, weight_g: new_weight_g } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/ai/meal-log/:id ──────────────────────────────────

export async function handleDeleteMealLog(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];
    const { id: mealLogId } = req.params;

    if (!userId || !token) throw new Error("Unauthorized");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
      throw new Error("Supabase internal configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Delete from meal_items first (Bypass RLS via Admin)
    const { error: itemDeleteError } = await supabaseAdmin
      .from("meal_items")
      .delete()
      .eq("meal_log_id", mealLogId);

    if (itemDeleteError) {
      console.error("[handleDeleteMealLog] Item Delete Error:", itemDeleteError);
      throw itemDeleteError;
    }

    // Step 2: Delete from ai_chat_messages (Bypass RLS via Admin)
    const { error: msgDeleteError } = await supabaseAdmin
      .from("ai_chat_messages")
      .delete()
      .eq("user_id", userId)
      .ilike("content", `%<meal_id id="${mealLogId}"%`);

    if (msgDeleteError) {
      console.error("[handleDeleteMealLog] Message Delete Error:", msgDeleteError);
    }

    // Step 3: Delete from meal_logs (User credentials for ownership check)
    const { error: logDeleteError } = await supabase
      .from("meal_logs")
      .delete()
      .eq("id", mealLogId)
      .eq("user_id", userId);

    if (logDeleteError) {
      console.error("[handleDeleteMealLog] Log Delete Error:", logDeleteError);
      throw logDeleteError;
    }

    res.json({ success: true, data: { id: mealLogId } });
  } catch (err) {
    next(err);
  }
}

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

    let finalImageUrl = body.imageUrl;

    const messagesToInvoke: any[] = [];

    // Mode unification: if user is logged in, always use the rich system prompt
    if (req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      if (body.imageBase64 && token) {
        finalImageUrl = await uploadAndRotateFoodPhoto(req.user.id, body.imageBase64, token);
      }

      if (token) {
        // Parallel fetch: user context + memory context (independent)
        const [dbContext, [emotionalProfile, semanticMemories, pastActions], activeSkills, matchedSkillDoc, kbContext] = await Promise.all([
          fetchUserContext(token, req.user.id),
          fetchAdvancedMemoryContext(req.user.id, body.message, token),
          fetchActiveSkills(req.user.id, token),
          fetchMatchingSkillDocument(req.user.id, body.message),
          fetchKnowledgeBaseContext(body.message, token),
        ]);

        if (dbContext) {
          const leanContext = getLeanUserContext(dbContext);
          const timezone = dbContext.profile?.timezone || 'UTC';
          
          let weatherAlert = "";
          // weatherData depends on dbContext.profile — must stay sequential
          const weatherData = await getOrFetchWeatherContext(dbContext.profile, req.user.id);
          
          const userLocalStr = now.toLocaleString("en-US", { timeZone: timezone });
          const userLocalTime = new Date(userLocalStr).getTime();
          const offsetMs = userLocalTime - now.getTime();

          const startOfDay5AMLocal = new Date(userLocalTime);
          startOfDay5AMLocal.setHours(5, 0, 0, 0);
          
          if (new Date(userLocalTime).getHours() < 5) {
            startOfDay5AMLocal.setDate(startOfDay5AMLocal.getDate() - 1);
          }
          
          const startOfDay5AM_UTC = new Date(startOfDay5AMLocal.getTime() - offsetMs);

          const supabaseUrl = process.env.SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;
          const supabaseCtx = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });

          const { data: earlyMsg } = await supabaseCtx.from('ai_chat_messages')
            .select('id')
            .eq('user_id', req.user.id)
            .gte('created_at', startOfDay5AM_UTC.toISOString())
            .limit(1);

          const isFirstMessageOfDay = !!(earlyMsg && earlyMsg.length === 0);

          if (earlyMsg && earlyMsg.length === 0) {
            const todayStr = new Date(userLocalTime).toLocaleDateString("en-CA");
            const d7 = new Date(userLocalTime);
            d7.setDate(d7.getDate() + 7);
            const today7Str = d7.toLocaleDateString("en-CA");

            const { data: futureLogs } = await supabaseCtx.from('environmental_logs')
              .select('*')
              .eq('user_id', req.user.id)
              .gt('date', todayStr)
              .lte('date', today7Str);

            const anomalousDays = (futureLogs || []).filter(l => (l.max_kp_index ?? 0) >= 5 || (l.pressure_drop_max_hpa ?? 0) >= 10);
            if (anomalousDays.length > 0) {
              const daysList = anomalousDays.map(l => `${l.date} (Kp: ${l.max_kp_index || 0}, Падение: ${l.pressure_drop_max_hpa || 0} гПа)`).join(", ");
              weatherAlert += `\n\n[PROACTIVE_FORECAST_ALERT: Внимание! В ближайшие 7 дней ожидаются неблагоприятные метеоусловия: ${daysList}. Аккуратно упомяни об этом пользователю один раз и дай короткие советы по подготовке (сон, лекарства, отдых) с учетом его диагнозов.]`;
            }
          }

          if (weatherData && (weatherData.max_kp_index >= 5 || weatherData.pressure_drop_max_hpa >= 10)) {
            weatherAlert += `\n\n[ENVIRONMENT_ALERT: Внимание! Сегодня магнитная буря (Kp-индекс: ${weatherData.max_kp_index}) и/или резкий перепад давления (Падение: ${weatherData.pressure_drop_max_hpa} гПа). Учитывай это в анализе симптомов пользователя (может болеть голова, слабость, мигрень, скачки давления).]`;
          }

          const userTimeStr = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone
          });
          const userDateStr = now.toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: timezone
          });

          // ── Build System Prompt via ChatPromptBuilder ─────────────
          const { ChatPromptBuilder } = await import("./prompts/chat-prompt-builder.js");

          const builder = new ChatPromptBuilder(chatMode === "diary" ? "diary" : "assistant")
            .withPersona(
              dbContext.profile.ai_name || 'Maya',
              userDateStr,
              userTimeStr
            )
            .withEmotionalContext(emotionalProfile)
            .withSemanticMemory(semanticMemories)
            .withPastActions(pastActions)
            .withActiveSkills(activeSkills)
            .withProfile(formatLeanProfile(dbContext.profile))
            .withDietaryRestrictions(formatDietaryRestrictions(dbContext.profile))
            .withGoalManagement();

          if (chatMode === "diary") {
            builder
              .withDiaryMode()
              .withFoodZones(formatFoodContraindicationZones(dbContext.profile))
              .withNutritionTargets(formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases, dbContext.somaticData))
              .withTodayProgress(formatTodayProgress(dbContext.recentMeals, timezone), "#### 🍽️ СЪЕДЕНО СЕГОДНЯ (ДНЕВНИК)")
              .withMealLogs(formatMealLogs(dbContext.recentMeals, timezone))
              .withSupplementProtocol(formatActiveSupplementProtocol(dbContext.profile))
              .withTodaySupplements(formatTodaySupplements(dbContext.todaySupplements, timezone))
              .withDeficitAwareRule()
              .withDiarySecurityRule();
          } else {
            // Adaptive Lab Context: detect if user is asking about lab results
            const LAB_INTENT_REGEX = /анализ|кровь|результат|показател|маркер|биохим|гемоглобин|ферритин|холестер|глюкоз|лейкоцит|эритроцит|тромбоцит|нейтрофил|лимфоцит|гематокрит|билирубин|креатинин|мочев|АЛТ|АСТ|ТТГ|Т[34]\b|тиреотроп|инсулин|кортизол|тестостер|эстрад|прогестер|пролактин|витамин\s*[dдDД]|железо\b|кальци|ферр|трансферр|гомоцистеин|цинк|магни|селен|фолат|фолиев/i;
            const isLabDeepDive = LAB_INTENT_REGEX.test(body.message || "");

            // Adaptive Diet Context: detect if user is asking about food
            const DIETARY_INTENT_REGEX = /еда|питание|ккал|калори|белок|белки|жир|углевод|макрос|диет|фото|продукт|состав|съест|покуша|куша|голод/i;
            const isDietDeepDive = DIETARY_INTENT_REGEX.test(body.message || "") || !!body.imageBase64 || !!finalImageUrl;

            builder
              .withAssistantMode()
              .withChronicConditions(formatChronicConditions(dbContext.profile))
              .withHistorySynopsis(formatHistorySynopsis(dbContext.profile, timezone))
              .withTestResults(formatTestResults(dbContext.recentTests, timezone, dbContext.profile))
              .withNutritionTargets(formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases, dbContext.somaticData))
              .withTodayProgress(formatTodayProgress(dbContext.recentMeals, timezone), "#### 🍽️ RECENT MEALS (LAST 24H)")
              .withMealLogs(
                isDietDeepDive
                  ? formatMealLogs(dbContext.recentMeals, timezone)
                  : "Детальный лог скрыт (не требуется для ответа). Опирайся только на агрегированный итог (СЪЕДЕНО СЕГОДНЯ) выше."
              )
              .withFoodZones(isDietDeepDive ? formatFoodContraindicationZones(dbContext.profile) : "")
              .withLabReport(isLabDeepDive ? formatLabReportDeep(dbContext.profile) : formatLabDiagnosticReport(dbContext.profile))
              .withKnowledgeBases(formatActiveKnowledgeBases(dbContext.activeKnowledgeBases))
              .withSupplementProtocol(formatActiveSupplementProtocol(dbContext.profile))
              .withTodaySupplements(formatTodaySupplements(dbContext.todaySupplements, timezone))
              .withDeficitAwareRule()
              .withCoachingMode(activeSkills, isFirstMessageOfDay)
              .withSkillDocument(matchedSkillDoc)
              .withKnowledgeBase(kbContext);
          }

          // Merge weather alert + skill check-in instruction if both present on first message of day
          if (isFirstMessageOfDay && activeSkills && activeSkills.length > 0 && weatherAlert) {
            weatherAlert += `\n[MERGE_ALERTS]: У тебя есть и weather alert, и skill check-in. Объедини их в ОДИН естественный абзац, не два отдельных блока. Пример: "Доброе утро! Сегодня небольшая магнитная буря — береги себя. Кстати, как продвигается [текущий шаг]?"`;
          }
          builder.withWeatherAlert(weatherAlert);

          const { systemPrompt } = builder.build();
          messagesToInvoke.push(new SystemMessage(systemPrompt));
        }
      }
      if (finalImageUrl) {
        messagesToInvoke.push(
          new HumanMessage({
            content: [
              { type: "text", text: body.message || "Пожалуйста, проанализируй это фото этикетки." },
              { type: "image_url", image_url: { url: finalImageUrl } }
            ]
          })
        );
      } else {
        messagesToInvoke.push(new HumanMessage(body.message));
      }
    } else {
      // Fallback for non-authenticated or generic requests
      messagesToInvoke.push(new SystemMessage("You are Maya, a supportive health assistant."));
      messagesToInvoke.push(new HumanMessage(body.message));
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
          imageUrl: finalImageUrl
        }
      }
    );

    // Extract the final message from the state
    const finalMessages = result.messages;
    const aiResponse = finalMessages[finalMessages.length - 1];

    const usage = (aiResponse as any).usage_metadata;
    if (usage) {
      console.log(`[Chat] 📊 Final Usage (${chatMode}): prompt=${usage.input_tokens}, completion=${usage.output_tokens}, total=${usage.total_tokens}`);
    }

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
        if (finalImageUrl) {
          userMsgPayload.image_url = finalImageUrl;
        }

        const aiMsgPayload = {
          user_id: req.user.id,
          thread_id: actualThreadId,
          role: "assistant",
          content: finalContent,
        };

        try {
          // Delay AI message timestamp slightly to ensure consistent ordering on rapid inserts
          const { error: err1 } = await supabase.from("ai_chat_messages").insert([userMsgPayload]);
          if (err1) console.error("[handleChat] Error inserting user msg (possible JWT expired):", err1);

          await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay

          const { error: err2 } = await supabase.from("ai_chat_messages").insert([aiMsgPayload]);
          if (err2) console.error("[handleChat] Error inserting AI msg:", err2);
        } catch (insertError) {
          console.error("[handleChat] Exception during message insertion:", insertError);
        }
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

// ── POST /api/v1/ai/chat/stream ── SSE Token-by-Token Streaming ─────

/**
 * Streaming variant of handleChat.
 * Reuses the same auth, context, system prompt, and image handling logic,
 * but streams LLM tokens to the client via SSE instead of returning a batch JSON.
 *
 * Transport: plain-text chunks (no JSON wrapping). The client accumulates them.
 * Post-stream: saves user + AI messages to ai_chat_messages (same as handleChat).
 */
export async function handleChatStream(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as any;
    const now = new Date();
    const chatMode = body.chatMode || 'default';

    let finalImageUrl = body.imageUrl;
    const messagesToInvoke: any[] = [];

    // ── Reuse handleChat's setup logic (auth, context, system prompt) ──
    if (req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      if (body.imageBase64 && token) {
        finalImageUrl = await uploadAndRotateFoodPhoto(req.user.id, body.imageBase64, token);
      }

      if (token) {
        // Parallel fetch: user context + memory context (independent)
        const [dbContext, [emotionalProfile, semanticMemories, pastActions], activeSkills, matchedSkillDoc, kbContext] = await Promise.all([
          fetchUserContext(token, req.user.id),
          fetchAdvancedMemoryContext(req.user.id, body.message, token),
          fetchActiveSkills(req.user.id, token),
          fetchMatchingSkillDocument(req.user.id, body.message),
          fetchKnowledgeBaseContext(body.message, token),
        ]);

        if (dbContext) {
          const leanContext = getLeanUserContext(dbContext);
          const timezone = dbContext.profile?.timezone || 'UTC';
          
          let weatherAlert = "";
          // weatherData depends on dbContext.profile — must stay sequential
          const weatherData = await getOrFetchWeatherContext(dbContext.profile, req.user.id);
          
          const userLocalStr = now.toLocaleString("en-US", { timeZone: timezone });
          const userLocalTime = new Date(userLocalStr).getTime();
          const offsetMs = userLocalTime - now.getTime();

          const startOfDay5AMLocal = new Date(userLocalTime);
          startOfDay5AMLocal.setHours(5, 0, 0, 0);
          
          if (new Date(userLocalTime).getHours() < 5) {
            startOfDay5AMLocal.setDate(startOfDay5AMLocal.getDate() - 1);
          }
          
          const startOfDay5AM_UTC = new Date(startOfDay5AMLocal.getTime() - offsetMs);

          const supabaseUrl = process.env.SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;
          const supabaseCtx = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
          });

          const { data: earlyMsg } = await supabaseCtx.from('ai_chat_messages')
            .select('id')
            .eq('user_id', req.user.id)
            .gte('created_at', startOfDay5AM_UTC.toISOString())
            .limit(1);

          const isFirstMessageOfDay = !!(earlyMsg && earlyMsg.length === 0);

          if (earlyMsg && earlyMsg.length === 0) {
            const todayStr = new Date(userLocalTime).toLocaleDateString("en-CA");
            const d7 = new Date(userLocalTime);
            d7.setDate(d7.getDate() + 7);
            const today7Str = d7.toLocaleDateString("en-CA");

            const { data: futureLogs } = await supabaseCtx.from('environmental_logs')
              .select('*')
              .eq('user_id', req.user.id)
              .gt('date', todayStr)
              .lte('date', today7Str);

            const anomalousDays = (futureLogs || []).filter(l => (l.max_kp_index ?? 0) >= 5 || (l.pressure_drop_max_hpa ?? 0) >= 10);
            if (anomalousDays.length > 0) {
              const daysList = anomalousDays.map(l => `${l.date} (Kp: ${l.max_kp_index || 0}, Падение: ${l.pressure_drop_max_hpa || 0} гПа)`).join(", ");
              weatherAlert += `\n\n[PROACTIVE_FORECAST_ALERT: Внимание! В ближайшие 7 дней ожидаются неблагоприятные метеоусловия: ${daysList}. Аккуратно упомяни об этом пользователю один раз и дай короткие советы по подготовке (сон, лекарства, отдых) с учетом его диагнозов.]`;
            }
          }

          if (weatherData && (weatherData.max_kp_index >= 5 || weatherData.pressure_drop_max_hpa >= 10)) {
            weatherAlert += `\n\n[ENVIRONMENT_ALERT: Внимание! Сегодня магнитная буря (Kp-индекс: ${weatherData.max_kp_index}) и/или резкий перепад давления (Падение: ${weatherData.pressure_drop_max_hpa} гПа). Учитывай это в анализе симптомов пользователя (может болеть голова, слабость, мигрень, скачки давления).]`;
          }

          const userTimeStr = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone
          });
          const userDateStr = now.toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: timezone
          });

          // ── Build System Prompt via ChatPromptBuilder ─────────────
          const { ChatPromptBuilder } = await import("./prompts/chat-prompt-builder.js");

          const builder = new ChatPromptBuilder(chatMode === "diary" ? "diary" : "assistant")
            .withPersona(
              dbContext.profile.ai_name || 'Maya',
              userDateStr,
              userTimeStr
            )
            .withEmotionalContext(emotionalProfile)
            .withSemanticMemory(semanticMemories)
            .withPastActions(pastActions)
            .withActiveSkills(activeSkills)
            .withProfile(formatLeanProfile(dbContext.profile))
            .withDietaryRestrictions(formatDietaryRestrictions(dbContext.profile))
            .withGoalManagement();

          if (chatMode === "diary") {
            builder
              .withDiaryMode()
              .withFoodZones(formatFoodContraindicationZones(dbContext.profile))
              .withNutritionTargets(formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases, dbContext.somaticData))
              .withTodayProgress(formatTodayProgress(dbContext.recentMeals, timezone), "#### 🍽️ СЪЕДЕНО СЕГОДНЯ (ДНЕВНИК)")
              .withMealLogs(formatMealLogs(dbContext.recentMeals, timezone))
              .withSupplementProtocol(formatActiveSupplementProtocol(dbContext.profile))
              .withTodaySupplements(formatTodaySupplements(dbContext.todaySupplements, timezone))
              .withDeficitAwareRule()
              .withDiarySecurityRule();
          } else {
            const LAB_INTENT_REGEX = /анализ|кровь|результат|показател|маркер|биохим|гемоглобин|ферритин|холестер|глюкоз|лейкоцит|эритроцит|тромбоцит|нейтрофил|лимфоцит|гематокрит|билирубин|креатинин|мочев|АЛТ|АСТ|ТТГ|Т[34]\b|тиреотроп|инсулин|кортизол|тестостер|эстрад|прогестер|пролактин|витамин\s*[dдDД]|железо\b|кальци|ферр|трансферр|гомоцистеин|цинк|магни|селен|фолат|фолиев/i;
            const isLabDeepDive = LAB_INTENT_REGEX.test(body.message || "");

            const DIETARY_INTENT_REGEX = /еда|питание|ккал|калори|белок|белки|жир|углевод|макрос|диет|фото|продукт|состав|съест|покуша|куша|голод/i;
            const isDietDeepDive = DIETARY_INTENT_REGEX.test(body.message || "") || !!body.imageBase64 || !!finalImageUrl;

            builder
              .withAssistantMode()
              .withChronicConditions(formatChronicConditions(dbContext.profile))
              .withHistorySynopsis(formatHistorySynopsis(dbContext.profile, timezone))
              .withTestResults(formatTestResults(dbContext.recentTests, timezone, dbContext.profile))
              .withNutritionTargets(formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases, dbContext.somaticData))
              .withTodayProgress(formatTodayProgress(dbContext.recentMeals, timezone), "#### 🍽️ RECENT MEALS (LAST 24H)")
              .withMealLogs(
                isDietDeepDive
                  ? formatMealLogs(dbContext.recentMeals, timezone)
                  : "Детальный лог скрыт (не требуется для ответа). Опирайся только на агрегированный итог (СЪЕДЕНО СЕГОДНЯ) выше."
              )
              .withFoodZones(isDietDeepDive ? formatFoodContraindicationZones(dbContext.profile) : "")
              .withLabReport(isLabDeepDive ? formatLabReportDeep(dbContext.profile) : formatLabDiagnosticReport(dbContext.profile))
              .withKnowledgeBases(formatActiveKnowledgeBases(dbContext.activeKnowledgeBases))
              .withSupplementProtocol(formatActiveSupplementProtocol(dbContext.profile))
              .withTodaySupplements(formatTodaySupplements(dbContext.todaySupplements, timezone))
              .withDeficitAwareRule()
              .withCoachingMode(activeSkills, isFirstMessageOfDay)
              .withSkillDocument(matchedSkillDoc)
              .withKnowledgeBase(kbContext);
          }

          // Merge weather alert + skill check-in instruction if both present on first message of day
          if (isFirstMessageOfDay && activeSkills && activeSkills.length > 0 && weatherAlert) {
            weatherAlert += `\n[MERGE_ALERTS]: У тебя есть и weather alert, и skill check-in. Объедини их в ОДИН естественный абзац, не два отдельных блока. Пример: "Доброе утро! Сегодня небольшая магнитная буря — береги себя. Кстати, как продвигается [текущий шаг]?"`;
          }
          builder.withWeatherAlert(weatherAlert);

          const { systemPrompt } = builder.build();
          messagesToInvoke.push(new SystemMessage(systemPrompt));
        }
      }
      if (finalImageUrl) {
        messagesToInvoke.push(
          new HumanMessage({
            content: [
              { type: "text", text: body.message || "Пожалуйста, проанализируй это фото этикетки." },
              { type: "image_url", image_url: { url: finalImageUrl } }
            ]
          })
        );
      } else {
        messagesToInvoke.push(new HumanMessage(body.message));
      }
    } else {
      messagesToInvoke.push(new SystemMessage("You are Maya, a supportive health assistant."));
      messagesToInvoke.push(new HumanMessage(body.message));
    }

    console.log(`[LangGraph Stream] Invoking graph for mode: ${chatMode}`);

    const actualThreadId = `${req.user?.id || 'anon'}-${chatMode}`;

    // ── Set SSE headers BEFORE any writes ──
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // ── Stream the graph using streamMode "messages" ──
    const stream = await appGraph.stream(
      { messages: messagesToInvoke },
      {
        configurable: {
          thread_id: actualThreadId,
          user_id: req.user?.id,
          token: req.headers.authorization?.split(" ")[1],
          chatMode: chatMode,
          nutritionalContext: body.nutritionalContext,
          imageUrl: finalImageUrl
        },
        streamMode: "messages",
      }
    );

    let fullContent = "";
    for await (const [message, _metadata] of stream) {
      if (
        isAIMessageChunk(message) &&
        message.content &&
        typeof message.content === "string"
      ) {
        // Skip tool-call-only chunks (they have tool_call_chunks but no text)
        if (
          message.tool_call_chunks &&
          message.tool_call_chunks.length > 0 &&
          !message.content
        ) {
          continue;
        }
        fullContent += message.content;
        res.write(message.content);
      }
    }

    // ── Post-stream: sanitize accumulated content ──
    fullContent = fullContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    fullContent = fullContent.replace(/\\([<>\*\_!#\(\)\[\]\-\.\+])/g, "$1").trim();

    // ── Save messages to ai_chat_messages (mirrors handleChat) ──
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
        if (finalImageUrl) {
          userMsgPayload.image_url = finalImageUrl;
        }

        const aiMsgPayload = {
          user_id: req.user.id,
          thread_id: actualThreadId,
          role: "assistant",
          content: fullContent,
        };

        try {
          const { error: err1 } = await supabase.from("ai_chat_messages").insert([userMsgPayload]);
          if (err1) console.error("[handleChatStream] Error inserting user msg:", err1);

          await new Promise((resolve) => setTimeout(resolve, 10));

          const { error: err2 } = await supabase.from("ai_chat_messages").insert([aiMsgPayload]);
          if (err2) console.error("[handleChatStream] Error inserting AI msg:", err2);
        } catch (insertError) {
          console.error("[handleChatStream] Exception during message insertion:", insertError);
        }
      }
    }

    res.end();
  } catch (error: unknown) {
    // If headers haven't been sent yet, pass to error handler
    if (!res.headersSent) {
      next(error);
    } else {
      // Headers already sent (stream started), just end the response
      console.error("[handleChatStream] Error during streaming:", error);
      res.end();
    }
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
 * Passes the image to LangChain vision node (gpt-5.4-mini) to extract markers.
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

    const mealIdsToFetch = new Set<string>();
    const mealIdRegex = /<meal_id id="([^"]+)"\s*\/>/;

    (messages || []).forEach(msg => {
      if (msg.role === "assistant") {
        const match = mealIdRegex.exec(msg.content);
        if (match && match[1]) {
          mealIdsToFetch.add(match[1]);
        }
      }
    });

    const mealMicrosMap: Record<string, any> = {};
    if (mealIdsToFetch.size > 0) {
      const { data: logMicros, error: msError } = await supabase
        .from("meal_logs")
        .select("id, micronutrients")
        .in("id", Array.from(mealIdsToFetch));
        
      if (!msError && logMicros) {
        logMicros.forEach(log => {
          if (log.micronutrients) {
            mealMicrosMap[log.id] = log.micronutrients;
          }
        });
      }
    }

    const history = (messages || []).map(msg => {
      let mealMicros = undefined;
      if (msg.role === "assistant") {
        const match = mealIdRegex.exec(msg.content);
        if (match && match[1] && mealMicrosMap[match[1]]) {
          mealMicros = mealMicrosMap[match[1]];
        }
      }
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        imageUrl: msg.image_url || undefined,
        createdAt: msg.created_at,
        mealMicros: mealMicros,
      };
    });

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
 * Handles premium GPT-5.4 diagnostic analysis of parsed biomarkers.
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

      // 2. Run GPT-5.4 diagnostic analysis
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
    const err = error as any;
    if (err.message?.startsWith("LAB_ANALYSIS_FAILED")) {
      const count = err.biomarkersCount || 0;
      res.status(422).json({
        success: false,
        error: "LAB_ANALYSIS_FAILED",
        message: count > 50
          ? `Слишком много показателей (${count}). Попробуйте загрузить не более 3 страниц анализов за раз.`
          : "Не удалось сформировать отчёт. Попробуйте ещё раз.",
        biomarkersCount: count,
        suggestion: "Попробуйте загрузить анализы частями — сначала первые 3 страницы, затем остальные.",
      });
      return;
    }
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

    // Phase 55: Targeted Cleanup if last report deleted
    if (reports.length === 0) {
      console.log(`[DeleteLabReport] Last report deleted for user ${userId}. Performing targeted cleanup.`);

      // 1. Clear Active Knowledge Bases
      const { error: kbError } = await supabase
        .from("active_condition_knowledge_bases")
        .delete()
        .eq("profile_id", userId);

      if (kbError) console.error("[DeleteLabReport] KB Cleanup Error:", kbError);

      // 2. Reset Profile Diagnostic Fields (Keep basic stats like weight/age)
      const { error: profError } = await supabase
        .from("profiles")
        .update({
          food_contraindication_zones: {},
          active_supplement_protocol: {},
          chronic_conditions: []
        })
        .eq("id", userId);

      if (profError) console.error("[DeleteLabReport] Profile Cleanup Error:", profError);
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

    // Macro deterministic compute
    const macros = computeDeterministicMacros(profile);

    // Micro deterministic compute
    const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases, dbContext.somaticData);

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

/**
 * Deletes the current user's account and all associated data.
 * 1. Storage buckets (nail_photos, food_photos, lab_reports)
 * 2. Database records (via cascading delete on Profile)
 * 3. Supabase Auth user (Admin API)
 */
export async function handleDeleteAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase Service Role configuration");
    }

    // Initialize Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[handleDeleteAccount] Beginning deletion for user: ${userId}`);

    // 1. Storage Cleanup
    const buckets = ["lab_reports", "nail_photos", "food_photos"];
    for (const bucket of buckets) {
      try {
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list(`${userId}/`);

        if (listError) {
          console.error(`[handleDeleteAccount] Error listing files in ${bucket}:`, listError);
          continue;
        }

        if (files && files.length > 0) {
          const filesToDelete = files.map((f) => `${userId}/${f.name}`);
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove(filesToDelete);

          if (deleteError) {
            console.error(`[handleDeleteAccount] Error deleting files from ${bucket}:`, deleteError);
          } else {
            console.log(`[handleDeleteAccount] Deleted ${filesToDelete.length} files from ${bucket}`);
          }
        }
      } catch (err) {
        console.error(`[handleDeleteAccount] Critical error in storage cleanup for ${bucket}:`, err);
      }
    }

    // 2. Database Cleanup (Cascading delete on profiles table)
    // Note: Assuming PostgreSQL native constraint 'ON DELETE CASCADE' is set up.
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (dbError) {
      console.error(`[handleDeleteAccount] Database cleanup error:`, dbError);
      throw new Error(`Failed to delete user profile: ${dbError.message}`);
    }
    console.log(`[handleDeleteAccount] Deleted profile and cascaded records for ${userId}`);

    // 3. Supabase Auth Deletion
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error(`[handleDeleteAccount] Auth deletion error:`, authError);
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }
    console.log(`[handleDeleteAccount] Successfully deleted auth user ${userId}`);

    res.json({
      success: true,
      message: "Account and all data deleted successfully",
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Aggregates daily macronutrients and micronutrients directly from the database for the diary counter.
 */
function parseSupplementMicro(name: string): Record<string, number> {
  const micros: Record<string, number> = {};
  const lower = name.toLowerCase();
  if (lower.includes("витамин d") || lower.includes("vitamin d")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(iu|me|ме)/i);
    micros["Витамин D"] = match ? parseInt(match[1], 10) / 40 : 50;
  }
  if (lower.includes("витамин c") || lower.includes("vitamin c")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|мг)/i);
    micros["Витамин C"] = match ? parseInt(match[1], 10) : 500;
  }
  if (lower.includes("магний") || lower.includes("magnesium")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|мг)/i);
    micros["Магний"] = match ? parseInt(match[1], 10) : 400;
  }
  if (lower.includes("омега") || lower.includes("omega")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|мг)/i);
    micros["Омега-3"] = match ? parseInt(match[1], 10) : 1000;
  }
  if (lower.includes("цинк") || lower.includes("zinc")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|мг)/i);
    micros["Цинк"] = match ? parseInt(match[1], 10) : 15;
  }
  if (lower.includes("железо") || lower.includes("iron")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|мг)/i);
    micros["Железо"] = match ? parseInt(match[1], 10) : 18;
  }
  if (lower.includes("b12")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mcg|мкг)/i);
    micros["Витамин B12"] = match ? parseInt(match[1], 10) : 2.4;
  }
  return micros;
}

export async function handleGetDiaryMacros(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];

    if (!userId || !token) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: "Missing startDate or endDate" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ success: false, message: "Supabase configuration missing" });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: recentMeals, error } = await supabase
      .from("meal_logs")
      .select("id, total_calories, micronutrients, meal_items(food_name, weight_g, calories, protein_g, fat_g, carbs_g)")
      .eq("user_id", userId)
      .gte("logged_at", startDate)
      .lte("logged_at", endDate);

    if (error) {
      console.error("[handleGetDiaryMacros] Supabase error:", error);
      res.status(500).json({ success: false, message: "Database query failed" });
      return;
    }

    const { data: recentSupps } = await supabase
      .from("supplement_logs")
      .select("supplement_name")
      .eq("user_id", userId)
      .gte("taken_at", startDate)
      .lte("taken_at", endDate);

    let calories = 0, protein = 0, fat = 0, carbs = 0;
    const microsMap: Record<string, number> = {};

    if (recentMeals) {
      for (const m of recentMeals) {
        calories += m.total_calories || 0;
        if (m.meal_items && Array.isArray(m.meal_items)) {
          for (const i of m.meal_items) {
            protein += i.protein_g || 0;
            fat += i.fat_g || 0;
            carbs += i.carbs_g || 0;
          }
        }
        if (m.micronutrients && typeof m.micronutrients === "object") {
          for (const [key, val] of Object.entries(m.micronutrients)) {
            if (typeof val === "number") {
              microsMap[key] = (microsMap[key] || 0) + val;
            }
          }
        }
      }
    }

    if (recentSupps) {
      for (const supp of recentSupps) {
        if (!supp.supplement_name) continue;
        const parsed = parseSupplementMicro(supp.supplement_name);
        for (const [k, v] of Object.entries(parsed)) {
          microsMap[k] = (microsMap[k] || 0) + v;
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        macros: {
          calories: Math.round(calories),
          protein: Math.round(protein),
          fat: Math.round(fat),
          carbs: Math.round(carbs)
        },
        microsMap
      }
    });
  } catch (error: unknown) {
    console.error("[handleGetDiaryMacros] Internal error:", error);
    next(error);
  }
}

// ── POST /api/v1/ai/analytics/correlate-symptoms ──────────────────────

const CorrelationInsightsSchema = z.object({
  correlations: z.array(z.object({
    symptom: z.string(),
    triggers: z.array(z.string()),
    confidence: z.number(),
    explanation: z.string()
  }))
});

export async function handleCorrelateSymptoms(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseName = createClient(supabaseUrl!, supabaseKey!);

    // Fetch data for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [mealsRes, symptomsRes, envRes, profileRes] = await Promise.all([
      supabaseName.from("meal_logs").select("logged_at, food_name, tags").eq("user_id", userId).gte("logged_at", thirtyDaysAgo),
      supabaseName.from("daily_symptoms").select("date, symptoms").eq("user_id", userId).gte("date", thirtyDaysAgo),
      supabaseName.from("environmental_logs").select("date, max_kp_index, pressure_drop_max_hpa").eq("user_id", userId).gte("date", thirtyDaysAgo),
      supabaseName.from("profiles").select("chronic_conditions").eq("id", userId).single()
    ]);

    const promptData = {
      meal_logs: mealsRes.data,
      daily_symptoms: symptomsRes.data,
      environmental_logs: envRes.data,
      chronic_conditions: profileRes.data?.chronic_conditions
    };

    const result = await callLlmStructured({
      schema: CorrelationInsightsSchema,
      schemaName: "symptom_correlation",
      systemPrompt: "You are an AI specialized in clinical correlation analysis. Identify triggers for symptoms based on food, weather/magnetic storms, and user conditions within the last 30 days. Only return significant correlations with high confidence.",
      userMessage: JSON.stringify(promptData),
      timeoutMs: LLM_TIMEOUTS.async,
      maxRetries: LLM_RETRIES.async,
      fallback: { correlations: [] },
      temperature: 0.3
    });

    if (result.source !== "fallback" && result.data.correlations.length > 0) {
      // Save to symptom_correlations using Supabase
      const payload = result.data.correlations.map((c) => ({
        user_id: userId,
        symptom_name: c.symptom,
        triggers: c.triggers,
        confidence: c.confidence,
        explanation: c.explanation,
        created_at: new Date().toISOString()
      }));
      await supabaseName.from("symptom_correlations").insert(payload);
    }

    res.json({
      success: true,
      data: result.data.correlations,
    });
  } catch (error: unknown) {
    next(error);
  }
}

// ── Label Scanner (Vision AI) ────────────────────────────────────────

export async function handleAnalyzeLabel(
  req: Request<{}, {}, AnalyzeLabelRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!userId || !token) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { imageBase64 } = req.body;

    console.log(`[handleAnalyzeLabel] Starting label scan for user ${userId}`);

    // 1. Fetch user context & format constraints strictly for Label Scanner
    const rawContext = await fetchUserContext(token, userId);
    const leanProfile = getLeanUserContext(rawContext)?.profile;

    let profileSummary = "";
    if (leanProfile) {
      profileSummary += `Возраст: ${leanProfile.age}, Пол: ${leanProfile.biological_sex}\n`;
      profileSummary += `Диета: ${leanProfile.diet_type || "смешанная"}\n`;
      
      if (leanProfile.chronic_conditions?.length) {
        profileSummary += `Хронические заболевания: ${leanProfile.chronic_conditions.join(", ")}\n`;
      }
      
      // Also format dietary constraints from raw context
      const dietaryConstraints = formatDietaryRestrictions(rawContext?.profile);
      if (dietaryConstraints) {
        profileSummary += `\n${dietaryConstraints}`;
      }
      
      // Form contraindications
      const foodZones = formatFoodContraindicationZones(rawContext?.profile);
      if (foodZones) {
        profileSummary += `\n${foodZones}`;
      }
    } else {
      profileSummary = "Профиль не заполнен. Оцените как стандартного взрослого человека.";
    }

    console.log(`[handleAnalyzeLabel] Profile summary extracted. Calling LLM...`);

    // 2. Call the new graph function for Label Scanner
    const output = await runLabelScanner(imageBase64, profileSummary);
    
    // 3. Return JSON response
    res.status(200).json({ success: true, data: output });
  } catch (error: unknown) {
    console.error("[handleAnalyzeLabel] Error:", error);
    next(error);
  }
}
