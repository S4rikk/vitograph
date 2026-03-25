/**
 * AI Controller тАФ Thin HTTP adapter between routes and AI services.
 *
 * Each handler:
 * 1. Reads validated `req.body` (already passed Zod validation)
 * 2. Maps request data to service function arguments
 * 3. Calls the AI service (ai-triggers.ts)
 * 4. Returns structured JSON response
 *
 * Pattern: Controller-Service separation (nodejs-backend-patterns ┬з1).
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

// тФАтФА Deterministic Micronutrient Norms (mirrors DailyAllowancesPanel.tsx) тФАтФА

const BACKEND_BASE_MICRO_TARGETS: Record<string, number> = {
  "╨Ъ╨░╨╗╨╕╨╣": 3500, "╨Ь╨░╨│╨╜╨╕╨╣": 400, "╨Т╨╕╤В╨░╨╝╨╕╨╜ A": 900, "╨Т╨╕╤В╨░╨╝╨╕╨╜ B12": 2.4,
  "╨ж╨╕╨╜╨║": 11, "╨Э╨░╤В╤А╨╕╨╣": 1500, "╨Т╨╕╤В╨░╨╝╨╕╨╜ C": 90, "╨Ц╨╡╨╗╨╡╨╖╨╛": 15,
  "╨Ъ╨░╨╗╤М╤Ж╨╕╨╣": 1000, "╨Т╨╕╤В╨░╨╝╨╕╨╜ D": 15, "╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░": 400, "╨Т╨╕╤В╨░╨╝╨╕╨╜ E": 15,
  "╨б╨╡╨╗╨╡╨╜": 55, "╨Т╨╕╤В╨░╨╝╨╕╨╜ B6": 1.3, "╨Щ╨╛╨┤": 150, "╨д╨╛╤Б╤Д╨╛╤А": 700, "╨Ю╨╝╨╡╨│╨░-3": 1.1,
};

const BACKEND_COFACTOR_MAP: Record<string, string> = {
  '╨Т╨╕╤В ╨б': '╨Т╨╕╤В╨░╨╝╨╕╨╜ C', '╨Т╨╕╤В╨░╨╝╨╕╨╜ ╨б': '╨Т╨╕╤В╨░╨╝╨╕╨╜ C', '╨Т╨╕╤В╨░╨╝╨╕╨╜ C': '╨Т╨╕╤В╨░╨╝╨╕╨╜ C',
  '╨Т╨╕╤В D': '╨Т╨╕╤В╨░╨╝╨╕╨╜ D', '╨Т╨╕╤В╨░╨╝╨╕╨╜ D': '╨Т╨╕╤В╨░╨╝╨╕╨╜ D', '╨Т╨╕╤В╨░╨╝╨╕╨╜ D3': '╨Т╨╕╤В╨░╨╝╨╕╨╜ D',
  '╨Т╨╕╤В B12': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', '╨Т╨╕╤В╨░╨╝╨╕╨╜ B12': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', '╨Т╨╕╤В╨░╨╝╨╕╨╜ ╨Т12': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B12',
  '╨Ъ╨╛╨▒╨░╨╗╨░╨╝╨╕╨╜': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B12',
  '╨Т╨╕╤В B6': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', '╨Т╨╕╤В╨░╨╝╨╕╨╜ B6': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', '╨Я╨╕╤А╨╕╨┤╨╛╨║╤Б╨╕╨╜': '╨Т╨╕╤В╨░╨╝╨╕╨╜ B6',
  '╨Т╨╕╤В A': '╨Т╨╕╤В╨░╨╝╨╕╨╜ A', '╨Т╨╕╤В╨░╨╝╨╕╨╜ A': '╨Т╨╕╤В╨░╨╝╨╕╨╜ A', '╨Т╨╕╤В╨░╨╝╨╕╨╜ ╨Р': '╨Т╨╕╤В╨░╨╝╨╕╨╜ A',
  '╨Т╨╕╤В E': '╨Т╨╕╤В╨░╨╝╨╕╨╜ E', '╨Т╨╕╤В╨░╨╝╨╕╨╜ E': '╨Т╨╕╤В╨░╨╝╨╕╨╜ E', '╨Т╨╕╤В╨░╨╝╨╕╨╜ ╨Х': '╨Т╨╕╤В╨░╨╝╨╕╨╜ E',
  '╨д╨╛╨╗╨░╤В': '╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', '╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░': '╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░',
  '╨Ц╨╡╨╗╨╡╨╖╨╛': '╨Ц╨╡╨╗╨╡╨╖╨╛', 'Fe': '╨Ц╨╡╨╗╨╡╨╖╨╛', '╨д╨╡╤А╤А╨╕╤В╨╕╨╜': '╨Ц╨╡╨╗╨╡╨╖╨╛',
  '╨Ъ╨░╨╗╤М╤Ж╨╕╨╣': '╨Ъ╨░╨╗╤М╤Ж╨╕╨╣', 'Ca': '╨Ъ╨░╨╗╤М╤Ж╨╕╨╣',
  '╨Ь╨░╨│╨╜╨╕╨╣': '╨Ь╨░╨│╨╜╨╕╨╣', 'Mg': '╨Ь╨░╨│╨╜╨╕╨╣',
  '╨ж╨╕╨╜╨║': '╨ж╨╕╨╜╨║', 'Zn': '╨ж╨╕╨╜╨║',
  '╨б╨╡╨╗╨╡╨╜': '╨б╨╡╨╗╨╡╨╜', 'Se': '╨б╨╡╨╗╨╡╨╜',
  '╨Щ╨╛╨┤': '╨Щ╨╛╨┤', '╨Ъ╨░╨╗╨╕╨╣': '╨Ъ╨░╨╗╨╕╨╣',
  '╨Э╨░╤В╤А╨╕╨╣': '╨Э╨░╤В╤А╨╕╨╣', '╨д╨╛╤Б╤Д╨╛╤А': '╨д╨╛╤Б╤Д╨╛╤А',
  '╨Ю╨╝╨╡╨│╨░-3': '╨Ю╨╝╨╡╨│╨░-3', 'DHA': '╨Ю╨╝╨╡╨│╨░-3', 'EPA': '╨Ю╨╝╨╡╨│╨░-3',
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

  if (!profile) return { micros, rationale: '╨Я╤А╨╛╤Д╨╕╨╗╤М ╨╜╨╡ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜.' };

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
      const boosted: string[] = [];
      if (Array.isArray(kb.cofactors)) {
        kb.cofactors.forEach((c: string) => {
          const nk = BACKEND_COFACTOR_MAP[c];
          if (nk && micros[nk] !== undefined) { 
            micros[nk] *= sevMult; 
            if (!boosted.includes(nk)) boosted.push(nk); 
          }
        });
      }
      if (boosted.length > 0) factors.push(`тЪХя╕П ${diag.condition_name} [${diag.severity}] (+${boosted.join(', ')})`);
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
      if (labBoosted.length > 0) factors.push(`ЁЯФм ╨Ф╨╡╤Д╨╕╤Ж╨╕╤В ╨┐╨╛ ╨░╨╜╨░╨╗╨╕╨╖╨░╨╝ (+${labBoosted.join(', ')})`);
    }
  }

  // LAYERS 1-9: Profile modifiers
  if (profile.diet_type === 'vegan') {
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.80); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 2.00); applyMod('╨ж╨╕╨╜╨║', 1.50);
    applyMod('╨Ъ╨░╨╗╤М╤Ж╨╕╨╣', 1.20); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.30); applyMod('╨Ю╨╝╨╡╨│╨░-3', 1.50);
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ A', 1.40); applyMod('╨Щ╨╛╨┤', 1.20);
    factors.push('╨Т╨╡╨│╨░╨╜');
  } else if (profile.diet_type === 'vegetarian') {
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.50); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 1.50); applyMod('╨ж╨╕╨╜╨║', 1.25);
    applyMod('╨Ъ╨░╨╗╤М╤Ж╨╕╨╣', 1.10); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.20); applyMod('╨Ю╨╝╨╡╨│╨░-3', 1.30);
    factors.push('╨Т╨╡╨│╨╡╤В╨░╤А╨╕╨░╨╜╨╡╤Ж');
  } else if (profile.diet_type === 'keto') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.30); applyMod('╨Э╨░╤В╤А╨╕╨╣', 1.40);
    factors.push('╨Ъ╨╡╤В╨╛');
  }

  if (profile.activity_level === 'moderate') {
    applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.10); applyMod('╨Ъ╨░╨╗╨╕╨╣', 1.10); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', 1.10);
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.05); applyMod('╨Э╨░╤В╤А╨╕╨╣', 1.10);
  } else if (profile.activity_level === 'active') {
    applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.15); applyMod('╨Ъ╨░╨╗╨╕╨╣', 1.15); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', 1.15);
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.10); applyMod('╨Э╨░╤В╤А╨╕╨╣', 1.15);
    factors.push('╨Т╤Л╤Б╨╛╨║╨░╤П ╨░╨║╤В╨╕╨▓╨╜╨╛╤Б╤В╤М');
  } else if (profile.activity_level === 'very_active') {
    applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.25); applyMod('╨Ъ╨░╨╗╨╕╨╣', 1.25); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', 1.20);
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.15); applyMod('╨Э╨░╤В╤А╨╕╨╣', 1.20); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ E', 1.10);
    factors.push('╨Ю╤З╨╡╨╜╤М ╨▓╤Л╤Б╨╛╨║╨░╤П ╨░╨║╤В╨╕╨▓╨╜╨╛╤Б╤В╤М');
  }

  if (profile.stress_level === 'moderate') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.10); applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.10);
  } else if (profile.stress_level === 'high') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.30); applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.20); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', 1.15);
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 1.10);
    factors.push('╨Т╤Л╤Б╨╛╨║╨╕╨╣ ╤Б╤В╤А╨╡╤Б╤Б');
  } else if (profile.stress_level === 'very_high') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.50); applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.30); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B6', 1.25);
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 1.20);
    factors.push('╨Ю╤З╨╡╨╜╤М ╨▓╤Л╤Б╨╛╨║╨╕╨╣ ╤Б╤В╤А╨╡╤Б╤Б');
  }

  if (profile.sun_exposure === 'minimal') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.60); factors.push('╨Ь╨░╨╗╨╛ ╤Б╨╛╨╗╨╜╤Ж╨░');
  } else if (profile.sun_exposure === 'moderate') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.20);
  }

  if (profile.climate_zone === 'polar') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.50); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.20); applyMod('╨Щ╨╛╨┤', 1.10);
    factors.push('╨Я╨╛╨╗╤П╤А╨╜╤Л╨╣ ╨║╨╗╨╕╨╝╨░╤В');
  } else if (profile.climate_zone === 'continental') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.30); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.10);
  } else if (profile.climate_zone === 'temperate') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.20);
  }

  if (profile.is_smoker) {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ C', 1.80); applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ E', 1.30);
    applyMod('╨б╨╡╨╗╨╡╨╜', 1.20); applyMod('╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', 1.25);
    factors.push('╨Ъ╤Г╤А╨╡╨╜╨╕╨╡');
  }

  if (profile.alcohol_frequency === 'moderate') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 1.15); applyMod('╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', 1.15);
    applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.10); applyMod('╨ж╨╕╨╜╨║', 1.10);
  } else if (profile.alcohol_frequency === 'heavy') {
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ B12', 1.30); applyMod('╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', 1.30);
    applyMod('╨Ь╨░╨│╨╜╨╕╨╣', 1.20); applyMod('╨ж╨╕╨╜╨║', 1.20);
    factors.push('╨з╨░╤Б╤В╤Л╨╣ ╨░╨╗╨║╨╛╨│╨╛╨╗╤М');
  }

  if (profile.pregnancy_status === 'pregnant') {
    applyMod('╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', 1.50); applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.80); applyMod('╨Ъ╨░╨╗╤М╤Ж╨╕╨╣', 1.30);
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.30); applyMod('╨Щ╨╛╨┤', 1.50); applyMod('╨Ю╨╝╨╡╨│╨░-3', 1.50);
    factors.push('╨С╨╡╤А╨╡╨╝╨╡╨╜╨╜╨╛╤Б╤В╤М');
  } else if (profile.pregnancy_status === 'breastfeeding') {
    applyMod('╨д╨╛╨╗╨╕╨╡╨▓╨░╤П ╨║╨╕╤Б╨╗╨╛╤В╨░', 1.25); applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.20); applyMod('╨Ъ╨░╨╗╤М╤Ж╨╕╨╣', 1.20);
    applyMod('╨Т╨╕╤В╨░╨╝╨╕╨╜ D', 1.20); applyMod('╨Щ╨╛╨┤', 1.60); applyMod('╨Ю╨╝╨╡╨│╨░-3', 1.30);
    factors.push('╨У╤А╤Г╨┤╨╜╨╛╨╡ ╨▓╤Б╨║╨░╤А╨╝╨╗╨╕╨▓╨░╨╜╨╕╨╡');
  }

  if (profile.biological_sex === 'female') {
    applyMod('╨Ц╨╡╨╗╨╡╨╖╨╛', 1.20); factors.push('╨Ц╨╡╨╜. ╨┐╨╛╨╗');
  }

  for (const key of Object.keys(micros)) micros[key] = Number(micros[key].toFixed(1));

  const rationale = factors.length > 0
    ? `╨Ш╨╜╨┤╨╕╨▓╨╕╨┤╤Г╨░╨╗╤М╨╜╤Л╨╡ ╨╜╨╛╤А╨╝╤Л (${factors.join(', ')}).`
    : '╨С╨░╨╖╨╛╨▓╨░╤П ╨╜╨╛╤А╨╝╨░.';

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

// тФАтФА Database Context Utility тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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


// тФАтФА Context Formatting Helpers тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

function formatTestResults(tests: any[] | null, timezone: string = "UTC"): string {
  if (!tests || tests.length === 0) return `╨Э╨╡╤В ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╨╜╤Л╤Е ╨░╨╜╨░╨╗╨╕╨╖╨╛╨▓.
тЪая╕П ╨Ш╨Э╨б╨в╨а╨г╨Ъ╨ж╨Ш╨п ╨Ф╨Ы╨п ╨Ш╨Ш ╨Я╨а╨Ю ╨Р╨Э╨Р╨Ы╨Ш╨Ч╨л: ╨Х╤Б╨╗╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╤Е╨╛╤З╨╡╤В ╨╛╨▒╤Б╤Г╨┤╨╕╤В╤М ╨░╨╜╨░╨╗╨╕╨╖╤Л, ╨Э╨Х╨Ь╨Х╨Ф╨Ы╨Х╨Э╨Э╨Ю ╤Б╨║╨░╨╢╨╕ ╨╡╨╝╤Г: "╨Я╨╛╨╢╨░╨╗╤Г╨╣╤Б╤В╨░, ╨┐╨╡╤А╨╡╨╣╨┤╨╕╤В╨╡ ╨▓ ╤А╨░╨╖╨┤╨╡╨╗ '╨Р╨╜╨░╨╗╨╕╨╖╤Л' ╨╕ ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╨╡ ╤Д╨╛╤В╨╛ ╨╕╨╗╨╕ PDF ╨▓╨░╤И╨╕╤Е ╨▒╨╗╨░╨╜╨║╨╛╨▓, ╤З╤В╨╛╨▒╤Л ╤П ╨╝╨╛╨│ ╨╕╤Е ╨╕╨╖╤Г╤З╨╕╤В╤М." ╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤З╨╡╤Б╨║╨╕ ╨Э╨Х ╨┐╤А╨╡╨┤╨╗╨░╨│╨░╨╣ ╨╜╨╕╨║╨░╨║╨╕╤Е ╨╕╨╜╤Л╤Е ╤Б╨┐╨╛╤Б╨╛╨▒╨╛╨▓ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕.`;

  return tests.map(t => {
    const name = t.biomarkers?.name_ru || t.biomarkers?.name_en || "╨Э╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╤Л╨╣ ╨╝╨░╤А╨║╨╡╤А";
    const date = new Date(t.test_date).toLocaleDateString("ru-RU", { timeZone: timezone });
    return `- [${date}] ${name}: ${t.value} ${t.unit}`;
  }).join("\n");
}

function formatMealLogs(meals: any[] | null, timezone: string = "UTC"): string {
  if (!meals || meals.length === 0) return "╨б╨╡╨│╨╛╨┤╨╜╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╡╤Й╤С ╨╜╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╡╨╗.";

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });

  return meals.map(m => {
    const mealDate = new Date(m.logged_at);
    const mealDateStr = mealDate.toLocaleDateString("en-CA", { timeZone: timezone });
    const isToday = mealDateStr === todayDateStr;
    const dayLabel = isToday ? "╨б╨╡╨│╨╛╨┤╨╜╤П" : "╨Т╤З╨╡╤А╨░";

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
        return `${i.food_name || '╨Э╨╡╨╕╨╖╨▓╨╡╤Б╤В╨╜╨╛╨╡ ╨▒╨╗╤О╨┤╨╛'} (${i.weight_g}╨│)`;
      }).join(', ');
      text += ` ${itemsText}: ${Math.round(mTotalCal)} ╨║╨║╨░╨╗, ╨С${Math.round(mTotalP)}╨│, ╨Ц${Math.round(mTotalF)}╨│, ╨г${Math.round(mTotalC)}╨│`;
    } else {
      text += ` ╨Я╤А╨╕╤С╨╝ ╨┐╨╕╤Й╨╕ (╨▒╨╡╨╖ ╨┤╨╡╤В╨░╨╗╨╡╨╣)`;
    }

    if (m.micronutrients && typeof m.micronutrients === 'object') {
      const micros = Object.entries(m.micronutrients)
        .filter(([_, v]) => typeof v === 'number' && (v as number) > 0)
        .map(([k, v]) => {
          const name = k.split(' (')[0];
          return `${name}: ${(v as number).toFixed(1)}`;
        })
        .join(', ');
      if (micros) text += `\n  ╨Ь╨╕╨║╤А╨╛: ${micros}`;
    }

    return text;
  }).join("\n");
}

/**
 * Creates a concise summary of the last 3-5 lab reports to provide history without token explosion.
 */
export function formatHistorySynopsis(profile: any, timezone: string = "UTC"): string {
  const reports = profile?.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return "╨Ш╤Б╤В╨╛╤А╨╕╨╕ ╨░╨╜╨░╨╗╨╕╨╖╨╛╨▓ ╨╜╨╡╤В.";

  // Take only last 3 reports
  const history = reports.slice(-3).map((r: any) => {
    const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString("ru-RU", { timeZone: timezone }) : "N/A";
    const summary = r.report?.summary || "╨Э╨╡╤В ╤А╨╡╨╖╤О╨╝╨╡";
    // Keep only the first sentence and truncate to 100 chars
    const shortSummary = summary.split(/[.!?]/)[0].substring(0, 100);
    return `${date}: ${shortSummary}`;
  });

  return `╨Ъ╨а╨Р╨в╨Ъ╨Р╨п ╨Ш╨б╨в╨Ю╨а╨Ш╨п ╨Р╨Э╨Р╨Ы╨Ш╨Ч╨Ю╨Т:\n${history.join("\n")}`;
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

  const activityMap = { "╨б╨╕╨┤╤П╤З╨╕╨╣": "sedentary", "╨Ы╨╡╨│╨║╨╕╨╣": "light", "╨б╤А╨╡╨┤╨╜╨╕╨╣": "moderate", "╨Т╤Л╤Б╨╛╨║╨╕╨╣": "active" };
  const dietMap = { "╨Т╤Б╨╡╤П╨┤╨╜╨╛╨╡": "omnivore", "╨Т╨╡╨│╨╡╤В╨░╤А╨╕╨░╨╜╤Б╤В╨▓╨╛": "vegetarian", "╨Ъ╨╡╤В╨╛": "keto", "╨Я╨░╨╗╨╡╨╛": "other" };
  const climateMap = { "╨г╨╝╨╡╤А╨╡╨╜╨╜╨░╤П": "temperate", "╨в╤А╨╛╨┐╨╕╨║╨╕": "tropical", "╨е╨╛╨╗╨╛╨┤╨╜╨░╤П": "polar" };
  const sexMap = { "╨Ь╤Г╨╢╤Б╨║╨╛╨╣": "male", "╨Ц╨╡╨╜╤Б╨║╨╕╨╣": "female" };

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
      is_smoker: p.is_smoker || (m.is_smoker === "╨Ф╨░" || m.is_smoker === true),
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

// тФАтФА Nutrition Targets Formatter (Phase 53e тАФ Deterministic) тФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

/**
 * Formats deterministic nutrition targets for the system prompt.
 * Uses computeDeterministicMicros instead of stale active_nutrition_targets.
 */
function formatNutritionTargets(profile: any, activeKnowledgeBases: any[] | null): string {
  const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases);

  let text = `${rationale}\n`;

  const macros = computeDeterministicMacros(profile);
  text += `╨Ь╨░╨║╤А╨╛╤Б╤Л: ╨Ъ╨║╨░╨╗=${macros.calories}, ╨С╨╡╨╗╨║╨╕=${macros.protein}╨│, ╨Ц╨╕╤А╤Л=${macros.fat}╨│, ╨г╨│╨╗╨╡╨▓╨╛╨┤╤Л=${macros.carbs}╨│\n`;

  const microEntries = Object.entries(micros).map(([k, v]) => `${k}: ${v}`).join(", ");
  text += `╨Ь╨╕╨║╤А╨╛╨╜╤Г╤В╤А╨╕╨╡╨╜╤В╤Л: ${microEntries}\n`;

  return text;
}

/**
 * Aggregates today's consumed nutrients from meal_logs into a summary for deficit calculation.
 */
function formatTodayProgress(meals: any[] | null, timezone: string = "UTC"): string {
  if (!meals || meals.length === 0) return "╨б╨╡╨│╨╛╨┤╨╜╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╡╤Й╤С ╨╜╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╡╨╗.";

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });

  const todayMeals = (meals || []).filter(m => {
    const mealDate = new Date(m.logged_at);
    return mealDate.toLocaleDateString("en-CA", { timeZone: timezone }) === todayDateStr;
  });

  if (todayMeals.length === 0) return "╨б╨╡╨│╨╛╨┤╨╜╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╡╤Й╤С ╨╜╨╕╤З╨╡╨│╨╛ ╨╜╨╡ ╨╡╨╗.";

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

  let text = `╨Ь╨░╨║╤А╨╛╤Б╤Л: ${Math.round(totalCal)} ╨║╨║╨░╨╗, ╨С╨╡╨╗╨║╨╕ ${Math.round(totalP)}╨│, ╨Ц╨╕╤А╤Л ${Math.round(totalF)}╨│, ╨г╨│╨╗╨╡╨▓╨╛╨┤╤Л ${Math.round(totalC)}╨│\n`;
  text += `╨Я╤А╨╕╤С╨╝╨╛╨▓ ╨┐╨╕╤Й╨╕: ${meals.length}\n`;

  if (Object.keys(microTotals).length > 0) {
    const entries = Object.entries(microTotals).map(([k, v]) => `${k}: ${Number(v).toFixed(1)}`).join(", ");
    text += `╨Ь╨╕╨║╤А╨╛╨╜╤Г╤В╤А╨╕╨╡╨╜╤В╤Л (╤Б╤Г╨╝╨╝╨░): ${entries}\n`;
  } else {
    text += `╨Ь╨╕╨║╤А╨╛╨╜╤Г╤В╤А╨╕╨╡╨╜╤В╤Л: ╨┤╨░╨╜╨╜╤Л╤Е ╨╜╨╡╤В.\n`;
  }

  return text;
}

// тФАтФА Dietary Restrictions Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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
    .map((r: string, i: number) => `${i + 1}. тЭМ ${r}`)
    .join("\n");

  return `\n--- ACTIVE DIETARY RESTRICTIONS (NON-NEGOTIABLE) ---\n${formatted}\n`;
}

// тФАтФА Chronic Conditions Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

  return `\n--- ╨е╨а╨Ю╨Э╨Ш╨з╨Х╨б╨Ъ╨Ш╨Х ╨Ч╨Р╨С╨Ю╨Ы╨Х╨Т╨Р╨Э╨Ш╨п ╨Ш ╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч╨л (╨Ъ╨а╨Ш╨в╨Ш╨з╨Х╨б╨Ъ╨Ш ╨Т╨Р╨Ц╨Э╨Ю) ---\n╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╕╨╝╨╡╨╡╤В ╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╕╨╡ ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╜╤Л╨╡ ╨┤╨╕╨░╨│╨╜╨╛╨╖╤Л:\n${formatted}\n\n╨в╨л ╨Ю╨С╨п╨Ч╨Р╨Э ╨г╨з╨Ш╨в╨л╨Т╨Р╨в╨м ╨н╨в╨Ш ╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч╨л ╨Т╨Ю ╨Т╨б╨Х╨е ╨б╨Т╨Ю╨Ш╨е ╨Ю╨в╨Т╨Х╨в╨Р╨е ╨Ш ╨б╨Ю╨Т╨Х╨в╨Р╨е ╨Я╨Ю ╨Я╨Ш╨в╨Р╨Э╨Ш╨о.\n`;
}

// тФАтФА Active Knowledge Base Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

  let kbContext = `\n--- ╨Р╨Ъ╨в╨Ш╨Т╨Э╨л╨Х ╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч╨л ╨Ш ╨С╨Р╨Ч╨л ╨Ч╨Э╨Р╨Э╨Ш╨Щ (Phase 49) ---\n`;
  kbContext += `╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨▓ ╨┤╨░╨╜╨╜╤Л╨╣ ╨╝╨╛╨╝╨╡╨╜╤В ╨╕╨╝╨╡╨╡╤В ╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╕╨╡ ╨░╨║╤В╨╕╨▓╨╜╤Л╨╡ ╨║╨╗╨╕╨╜╨╕╤З╨╡╤Б╨║╨╕╨╡ ╨┐╨░╤В╤В╨╡╤А╨╜╤Л. ╨Ш╨б╨Я╨Ю╨Ы╨м╨Ч╨г╨Щ ╨н╨в╨Ш ╨Ф╨Р╨Э╨Э╨л╨Х ╨┤╨╗╤П ╨║╨╛╤А╤А╨╡╨║╤В╨╕╤А╨╛╨▓╨║╨╕ ╨┐╨╕╤В╨░╨╜╨╕╤П ╨╕ ╨╛╨▒╤А╨░╨╖╨░ ╨╢╨╕╨╖╨╜╨╕:\n\n`;

  uniqueKbs.forEach((kb) => {
    const data = kb.knowledge_data;
    if (!data) return;

    kbContext += `### ${kb.condition_name} (╨б╤В╨╡╨┐╨╡╨╜╤М: ${kb.severity})\n`;
    kbContext += `- ╨Я╨░╤В╨╛╤Д╨╕╨╖╨╕╨╛╨╗╨╛╨│╨╕╤П: ${data.pathophysiology_simple || 'N/A'}\n`;
    kbContext += `- ╨Ъ╨╛╤Д╨░╨║╤В╨╛╤А╤Л (╨Я╨╛╨╝╨╛╨│╨░╤О╤В): ${data.cofactors?.join(", ") || 'N/A'}\n`;
    kbContext += `- ╨Ш╨╜╨│╨╕╨▒╨╕╤В╨╛╤А╤Л (╨Ь╨╡╤И╨░╤О╤В): ${data.inhibitors?.join(", ") || 'N/A'}\n`;
    kbContext += `- ╨Я╤А╨░╨▓╨╕╨╗╨░ ╨╛╨▒╤А╨░╨╖╨░ ╨╢╨╕╨╖╨╜╨╕: ${data.lifestyle_rules?.join("; ") || 'N/A'}\n\n`;
  });

  return kbContext;
}

// тФАтФА Supplement Protocol Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

/**
 * Formats the active supplement protocol for the AI context.
 */
function formatActiveSupplementProtocol(profile: any): string {
  if (!profile || !profile.active_supplement_protocol || Object.keys(profile.active_supplement_protocol).length === 0) return "";

  const proto = profile.active_supplement_protocol;
  let protoContext = `\n--- ╨Р╨Ъ╨в╨Ш╨Т╨Э╨л╨Щ ╨Я╨а╨Ю╨в╨Ю╨Ъ╨Ю╨Ы ╨Ф╨Ю╨С╨Р╨Т╨Ю╨Ъ ╨Ш ╨Т╨Ш╨в╨Р╨Ь╨Ш╨Э╨Ю╨Т (Phase 50) ---\n`;
  protoContext += `╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О ╨╜╨░╨╖╨╜╨░╤З╨╡╨╜ ╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╕╨╣ ╨┐╤А╨╛╤В╨╛╨║╨╛╨╗ ╨║╨╛╨╝╨┐╨╡╨╜╤Б╨░╤Ж╨╕╨╕ ╨┤╨╡╤Д╨╕╤Ж╨╕╤В╨╛╨▓. ╨Э╨Р╨Я╨Ю╨Ь╨Ш╨Э╨Р╨Щ ╨╡╨╝╤Г ╨╛ ╨▓╤А╨╡╨╝╨╡╨╜╨╕ ╨┐╤А╨╕╨╡╨╝╨░ ╨╕ ╤Б╨╛╨▓╨╝╨╡╤Б╤В╨╕╨╝╨╛╤Б╤В╨╕:\n\n`;
  protoContext += `╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡: ${proto.title}\n`;
  protoContext += `╨Ю╨▒╨╛╤Б╨╜╨╛╨▓╨░╨╜╨╕╨╡: ${proto.protocol_rationale}\n\n`;

  if (Array.isArray(proto.items)) {
    protoContext += `**╨Э╨░╨╖╨╜╨░╤З╨╡╨╜╨╜╤Л╨╡ ╨┤╨╛╨▒╨░╨▓╨║╨╕:**\n`;
    proto.items.forEach((item: any) => {
      protoContext += `- ${item.name_ru} (${item.dosage}). ╨Т╤А╨╡╨╝╤П: ${item.timing}, ${item.food_relation}. ╨Ф╨╗╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М: ${item.duration_weeks} ╨╜╨╡╨┤.\n`;
      if (item.antagonists && item.antagonists.length > 0) {
        protoContext += `  тЪая╕П ╨Э╨╡╤Б╨╛╨▓╨╝╨╡╤Б╤В╨╕╨╝╨╛ ╤Б: ${item.antagonists.join(", ")}\n`;
      }
    });
  }

  if (Array.isArray(proto.warnings) && proto.warnings.length > 0) {
    protoContext += `\n**╨Ю╨▒╤Й╨╕╨╡ ╨┐╤А╨╡╨┤╤Г╨┐╤А╨╡╨╢╨┤╨╡╨╜╨╕╤П:**\n${proto.warnings.map((w: string) => `- ${w}`).join("\n")}\n`;
  }

  return protoContext + "\n";
}

// тФАтФА Supplement Logs Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

function formatTodaySupplements(logs: any[] | null, timezone: string = "UTC"): string {
  if (!logs || logs.length === 0) return "╨б╨╡╨│╨╛╨┤╨╜╤П ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╡╤Й╨╡ ╨╜╨╡ ╨╛╤В╨╝╨╡╤З╨░╨╗ ╨┐╤А╨╕╨╡╨╝ ╨С╨Р╨Ф╨╛╨▓.";

  return logs.map(l => {
    const time = new Date(l.taken_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    const status = l.was_on_time ? "тЬЕ ╨Т╨╛╨▓╤А╨╡╨╝╤П" : "тЪая╕П ╨б ╨╛╨┐╨╛╨╖╨┤╨░╨╜╨╕╨╡╨╝ / ╨Э╨╡ ╨┐╨╛ ╨│╤А╨░╤Д╨╕╨║╤Г";
    return `- [${time}] ${l.supplement_name} (${l.dosage_taken}) тАФ ${status}`;
  }).join("\n");
}

// тФАтФА Lab Diagnostic Report Formatter тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

function formatFoodContraindicationZones(profile: any): string {
  if (!profile) return "";
  let baseContext = "";

  // Extract personal food zones from profile
  const foodZones = profile.food_contraindication_zones;
  if (foodZones && Object.keys(foodZones).length > 0) {
    baseContext += `\n--- ╨Я╨Х╨а╨б╨Ю╨Э╨Р╨Ы╨м╨Э╨л╨Х ╨Ч╨Ю╨Э╨л ╨Я╨а╨Ю╨Ф╨г╨Ъ╨в╨Ю╨Т (╨Ю╨в╨Ъ╨Ы╨Ю╨Э╨Х╨Э╨Ш╨п ╨Я╨Ю ╨Р╨Э╨Р╨Ы╨Ш╨Ч╨Р╨Ь) ---\n`;

    if (Array.isArray(foodZones.red) && foodZones.red.length > 0) {
      baseContext += `ЁЯФ┤ ╨Ъ╨а╨Р╨б╨Э╨Р╨п ╨Ч╨Ю╨Э╨Р (╨б╨в╨а╨Ю╨У╨Ш╨Щ ╨Ч╨Р╨Я╨а╨Х╨в):\n` + foodZones.red.map((i: any) => `- ${i.substance} (╨Э╨░╨┐╤А╨╕╨╝╨╡╤А: ${i.found_in?.join(', ') || 'N/A'}): ${i.reason}`).join('\n') + '\n';
    }
    if (Array.isArray(foodZones.yellow) && foodZones.yellow.length > 0) {
      baseContext += `ЁЯЯб ╨Ц╨Б╨Ы╨в╨Р╨п ╨Ч╨Ю╨Э╨Р (╨Ю╨У╨а╨Р╨Э╨Ш╨з╨Х╨Э╨Ю):\n` + foodZones.yellow.map((i: any) => `- ${i.substance} (╨Ы╨╕╨╝╨╕╤В: ${i.daily_limit || '╤Г╨╝╨╡╤А╨╡╨╜╨╜╨╛'}): ${i.reason}`).join('\n') + '\n';
    }
    if (Array.isArray(foodZones.green) && foodZones.green.length > 0) {
      baseContext += `ЁЯЯв ╨Ч╨Х╨Ы╨Б╨Э╨Р╨п ╨Ч╨Ю╨Э╨Р (╨а╨Х╨Ъ╨Ю╨Ь╨Х╨Э╨Ф╨Ю╨Т╨Р╨Э╨Ю):\n` + foodZones.green.map((i: any) => `- ${i.substance} (╨Ф╨╛╨╖╨░: ${i.daily_limit || '╨╡╨╢╨╡╨┤╨╜╨╡╨▓╨╜╨╛'}): ${i.reason}`).join('\n') + '\n';
    }
    baseContext += `╨б╨в╨а╨Ю╨У╨Ю ╨г╨з╨Ш╨в╨л╨Т╨Р╨Щ ╨н╨в╨Ш ╨Ч╨Ю╨Э╨л ╨Я╨а╨Ш ╨Ю╨ж╨Х╨Э╨Ъ╨Х ╨Я╨а╨Ю╨Ф╨г╨Ъ╨в╨Ю╨Т ╨Э╨Р ╨д╨Ю╨в╨Ю.\n`;
  }
  return baseContext;
}

/**
 * Extracts the latest lab diagnostic report from the profile
 * and formats it as a context block for the chat system prompt.
 */
function formatLabDiagnosticReport(profile: any): string {
  if (!profile) return "";

  let baseContext = formatFoodContraindicationZones(profile);

  const reports = profile.lab_diagnostic_reports;
  if (!Array.isArray(reports) || reports.length === 0) return baseContext;

  const latest = reports[reports.length - 1];
  const report = latest.report;
  if (!report) return baseContext;

  const patterns = report.diagnostic_patterns
    ?.map((p: any) => p.pattern_name)
    .join(", ") || "╨Э╨╡╤В";

  const priorities = report.priority_actions
    ?.map((a: any) => `[${a.priority}] ${a.action}`)
    .join("; ") || "╨Э╨╡╤В";

  return baseContext +
    `\n--- ╨Я╨Ю╨б╨Ы╨Х╨Ф╨Э╨Ш╨Щ ╨Ю╨в╨з╨Б╨в ╨Я╨Ю ╨Р╨Э╨Р╨Ы╨Ш╨Ч╨Р╨Ь ╨Ш ╨Ф╨Ш╨Р╨У╨Э╨Ю╨б╨в╨Ш╨Ъ╨Р (╨╛╤В ${latest.timestamp}) ---\n` +
    `╨а╨╡╨╖╤О╨╝╨╡: ${report.summary}\n` +
    `╨Т╨л╨п╨Т╨Ы╨Х╨Э╨Э╨л╨Х ╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч╨л ╨Ш ╨Я╨Р╨в╨в╨Х╨а╨Э╨л: ${patterns}\n` +
    `╨Я╤А╨╕╨╛╤А╨╕╤В╨╡╤В╤Л: ${priorities}\n` +
    `\n╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╣ ╤Н╤В╤Г ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨╖╨░╨▒╨╛╨╗╨╡╨▓╨░╨╜╨╕╤П╤Е ╨╕ ╤Б╨╕╨╜╨┤╤А╨╛╨╝╨░╤Е ╨┤╨╗╤П ╤Б╤В╤А╨╛╨│╨╛╨╣ ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗╨╕╨╖╨░╤Ж╨╕╨╕ ╨┤╨╕╨░╨╗╨╛╨│╨░! ╨в╤Л ╨Ч╨Э╨Р╨Х╨и╨м ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╤Л ╨░╨╜╨░╨╗╨╕╨╖╨╛╨▓ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П.\n\n` +
    `тЪая╕П CLEAN SLATE RULE: If the PROFILE OVERVIEW and BLOOD TESTS sections are EMPTY, you MUST NOT reference any past medical diagnoses (e.g., neutropenia) from memory. Assume the user is starting fresh and healthy unless data is currently present.`;
}

// тФАтФА Default user profile for requests without explicit profile тФАтФАтФАтФАтФАтФАтФА

const DEFAULT_USER_PROFILE = {
  age: 30, // Default age fallback
  biologicalSex: null,
  dietType: null,
  chronicConditions: [],
  activityLevel: null,
  is_smoker: false,
  is_pregnant: false,
};

// тФАтФА PATCH /api/v1/ai/meal-log/:id тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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
        const foodName = items[0]?.food_name || '╨С╨╗╤О╨┤╨╛';
        const newMacroLine = `╨Ч╨░╨┐╨╕╤Б╨░╨╗ ${Math.round(new_weight_g)}╨│ ${foodName}: ${Math.round(updatedMacros.total_calories)} ╨║╨║╨░╨╗, ${updatedMacros.total_protein.toFixed(1)}╨│ ╨▒╨╡╨╗╨║╨╛╨▓, ${updatedMacros.total_fat.toFixed(1)}╨│ ╨╢╨╕╤А╨╛╨▓, ${updatedMacros.total_carbs.toFixed(1)}╨│ ╤Г╨│╨╗╨╡╨▓╨╛╨┤╨╛╨▓`;
        
        // Replace the entire block from "╨Ч╨░╨┐╨╕╤Б╨░╨╗" to "╤Г╨│╨╗╨╡╨▓╨╛╨┤╨╛╨▓"
        newContent = newContent.replace(/╨Ч╨░╨┐╨╕╤Б╨░╨╗[\s\S]*?╤Г╨│╨╗╨╡╨▓╨╛╨┤╨╛╨▓/g, newMacroLine);

        // 5b. Atomic Reconstruction of Micros
        // Remove old micro tags first to avoid duplicates or orphans
        newContent = newContent.replace(/<nutr type="micro">[\s\S]*?<\/nutr>/g, "").trim();

        // Build new tags
        const microTags = Object.entries(updatedMicros)
          .map(([k, v]) => {
            const nameOnly = k.split(' (')[0];
            const unit = k.match(/\((.*?)\)/)?.[1] || '╨│';
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

// тФАтФА DELETE /api/v1/ai/meal-log/:id тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА POST /api/v1/ai/chat тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

    // Mode unification: if user is logged in, always use the rich system prompt
    if (req.user?.id) {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        const dbContext = await fetchUserContext(token, req.user.id);
        if (dbContext) {
          const leanContext = getLeanUserContext(dbContext);
          const timezone = dbContext.profile?.timezone || 'UTC';
          const userTimeStr = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: timezone
          });
          const userDateStr = now.toLocaleDateString('ru-RU', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: timezone
          });

          let systemPrompt = `You are ${dbContext.profile.ai_name || 'Maya'}, a senior medical expert and supportive health companion. 
Current User Local Date: ${userDateStr}
Current User Local Time: ${userTimeStr}

### FOOD LOGGING (CRITICAL)
- FOR EVERY MEAL: You MUST use the 'log_meal' tool.
- NEVER just reply with text like "╨Ч╨░╨┐╨╕╤Б╨░╨╗". The user expects to see a FoodCard, which only appears if the tool is called and structured data is returned.
- If the user mentions food, your priority is to invoke the tool immediately.

### CORE PERSONA
- You are a knowledgeable, empathetic, and human-like companion.
- Your tone is natural Russian, like a professional but friendly mentor.
- Use 1-2 emojis (ЁЯеС, ЁЯФе, ЁЯТк, ЁЯеЧ) naturally. Avoid robotic or repetitive phrases.
- IMPORTANT: Avoid starting sentences with generic fillers like "╨Ъ╤А╤Г╤В╨╛!" or "╨Ю╤В╨╗╨╕╤З╨╜╨╛!". Communicate like a real person.

### CONVERSATIONAL RULES
- APP BOUNDARIES (CRITICAL): You are strictly FOREVER FORBIDDEN from referencing, suggesting, or linking to ANY external internet resources, websites, browser extensions (e.g., Google Workspace), or third-party apps. EVERYTHING the user discusses must be addressed EXCLUSIVELY within the context of the Vitograph app, your own internal capabilities, and its built-in tools.
- MEAL AWARENESS: Use the provided local time to suggest appropriate meals (╨Ч╨░╨▓╤В╤А╨░╨║/╨Ю╨▒╨╡╨┤/╨Я╨╡╤А╨╡╨║╤Г╤Б/╨г╨╢╨╕╨╜).
- FLUIDITY: Write in clear, natural paragraphs. 
  тЫФ FORBIDDEN FORMATTING: NEVER use markdown in your responses. This means:
    - NO headers (###, ##, #)
    - NO numbered lists (1., 2., 3.)
    - NO bullet points (-, *)
    - NO bold markers (**text**)
  Instead, use natural Russian prose. Separate ideas with paragraphs (double newline).
  тЫФ FORBIDDEN: NEVER use image placeholders like [Image of...] or similar descriptive text in brackets. You cannot show images in the chat, so do not describe them.
  The ONLY allowed formatting is <nutr> tags and <meal_score> tags.
- TAGS (CRITICAL): You MUST wrap EVERY single mention of a nutrient, vitamin, mineral, or blood biomarker (e.g. Glucose, Iron) in <nutr type="...">Label</nutr> tags. This applies to the main text, lists, and recommendations. For example: <nutr type="marker">╨║╨░╨╗╨╕╨╣</nutr>, <nutr type="vitamin_c">╨▓╨╕╤В╨░╨╝╨╕╨╜ C</nutr>. 
  *   ╨Ф╨╗╤П ╤В╨╡╨│╨╛╨▓ <nutr> ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╣ ╤Б╨┐╨╡╤Ж╨╕╤Д╨╕╤З╨╜╤Л╨╡ ╤В╨╕╨┐╤Л, ╨╡╤Б╨╗╨╕ ╨╛╨╜╨╕ ╨╕╨╖╨▓╨╡╤Б╤В╨╜╤Л: type="iron" (╨Ц╨╡╨╗╨╡╨╖╨╛), type="calcium" (╨Ъ╨░╨╗╤М╤Ж╨╕╨╣), type="magnesium" (╨Ь╨░╨│╨╜╨╕╨╣), type="vitamin_c", type="vitamin_d", type="vitamin_b" (B6, B12, ╨д╨╛╨╗╨░╤В╤Л), type="omega" (╨Ю╨╝╨╡╨│╨░-3). ╨Ф╨╗╤П ╨╛╤Б╤В╨░╨╗╤М╨╜╤Л╤Е ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╣ type="marker".  тЫФ STRICT FORBIDDEN: NEVER tag medical conditions, diseases, or diagnoses (e.g., DO NOT tag "╨╜╨╡╨╣╤В╤А╨╛╨┐╨╡╨╜╨╕╤П", "╨░╨╜╨╡╨╝╨╕╤П", "╨┤╨╕╨░╨▒╨╡╤В"). Tag ONLY the substance or marker itself.
  *   Use type="protein" for proteins (╨▒╨╡╨╗╨╛╨║).
  *   Use type="fat" for fats (╨╢╨╕╤А╤Л).
  *   Use type="carbs" for carbohydrates (╤Г╨│╨╗╨╡╨▓╨╛╨┤╤Л).
  *   Use type="calories" for calories (╨║╨░╨╗╨╛╤А╨╕╨╕).
  - Use type="marker" if no specific match is found in the list above.
  *   тЪая╕П STRICT: Use ONLY the tag <nutr>. Any typos like <nutrtr> or <nutrr> are forbidden.
  - тЪая╕П WORD BOUNDARY: ╨Т╨б╨Х╨У╨Ф╨Р ╨╛╨▒╨╛╤А╨░╤З╨╕╨▓╨░╨╣ ╨Т ╨в╨Х╨У ╨Я╨Ю╨Ы╨Э╨Ю╨Х ╨б╨Ы╨Ю╨Т╨Ю ╨ж╨Х╨Ы╨Ш╨Ъ╨Ю╨Ь. ╨Э╨Ш╨Ъ╨Ю╨У╨Ф╨Р ╨╜╨╡ ╤А╨░╨╖╤А╤Л╨▓╨░╨╣ ╤Б╨╗╨╛╨▓╨╛ ╤В╨╡╨│╨╛╨╝. ╨Я╤А╨░╨▓╨╕╨╗╤М╨╜╨╛: <nutr type="marker">╨╝╨░╨│╨╜╨╕╨╣</nutr>. ╨Э╨Х╨Я╨а╨Р╨Т╨Ш╨Ы╨м╨Э╨Ю: <nutr type="marker">╨╝╨░╨│╨╜╨╕</nutr>╨╣.
Never put a newline before or after these tags.
- TAGS (CRITICAL): Use <nutr type="marker">Label</nutr> for nutrient mentions in the narrative text.
- TECHNICAL BLOCK (MANDATORY AT THE END): After your human response, you MUST append a new section:
  1. FORMAT: ╨Ч╨░╨┐╨╕╤Б╨░╨╗ [╨▓╨╡╤Б]╨│ [╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡]: [╨║╨░╨╗╨╛╤А╨╕╨╕] ╨║╨║╨░╨╗, [╨▒╨╡╨╗╨║╨╕]╨│ ╨▒╨╡╨╗╨║╨╛╨▓, [╨╢╨╕╤А╤Л]╨│ ╨╢╨╕╤А╨╛╨▓, [╤Г╨│╨╗╨╡╨▓╨╛╨┤╤Л]╨│ ╤Г╨│╨╗╨╡╨▓╨╛╨┤╨╛╨▓
  2. <meal_score score="[0-100]" reason="[╨║╤А╨░╤В╨║╨░╤П ╨┐╤А╨╕╤З╨╕╨╜╨░]" />
  3. <nutr type="micro">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ (╨Ч╨╜╨░╤З╨╡╨╜╨╕╨╡+╨╡╨┤)</nutr> - for each micronutrient.
- HUMAN RESPONSE STYLE: Write 2-4 descriptive sentences first. Mention nutrients (e.g. "╨▒╨╛╨│╨░╤В ╨╢╨╡╨╗╨╡╨╖╨╛╨╝"), then append the TECHNICAL BLOCK.

### MEDICAL & DIETARY BOUNDARIES
- STRICTNESS: If the user has absolute dietary restrictions, be firm but supportive in helping them follow those rules. No compromises on banned items.
- PERSONALIZATION: Use the clinical context (blood tests, diet history, markers) to make your advice specific to this user.

### USER CLINICAL CONTEXT
#### ЁЯУЛ PROFILE OVERVIEW
${JSON.stringify(leanContext!.profile)}
${formatDietaryRestrictions(dbContext.profile)}`;

          if (chatMode === "diary") {
            systemPrompt += `
${formatFoodContraindicationZones(dbContext.profile)}

#### ЁЯОп ╨Ш╨Э╨Ф╨Ш╨Т╨Ш╨Ф╨г╨Р╨Ы╨м╨Э╨л╨Х ╨Э╨Ю╨а╨Ь╨л ╨Я╨Ш╨в╨Р╨Э╨Ш╨п (╨Ф╨╡╤В╨╡╤А╨╝╨╕╨╜╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╡)
${formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases)}

#### ЁЯН╜я╕П RECENT MEALS (LAST 24H)
╨Р╨│╤А╨╡╨│╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╣ ╨╕╤В╨╛╨│:
${formatTodayProgress(dbContext.recentMeals, timezone)}

╨Ф╨╡╤В╨░╨╗╤М╨╜╤Л╨╣ ╨╗╨╛╨│ ╨┐╤А╨╕╤С╨╝╨╛╨▓ ╨┐╨╕╤Й╨╕:
${formatMealLogs(dbContext.recentMeals, timezone)}

${formatActiveSupplementProtocol(dbContext.profile)}

#### ЁЯТК ╨Т╨л╨Я╨Ш╨в╨л╨Х ╨б╨Х╨У╨Ю╨Ф╨Э╨п ╨С╨Р╨Ф╨л (Compliance)
${formatTodaySupplements(dbContext.todaySupplements, timezone)}
╨б╨▓╨╡╤А╤М ╤Б╨┐╨╕╤Б╨╛╨║ **╨Р╨Ъ╨в╨Ш╨Т╨Э╨л╨Щ ╨Я╨а╨Ю╨в╨Ю╨Ъ╨Ю╨Ы** ╤Б╨╛ ╤Б╨┐╨╕╤Б╨║╨╛╨╝ **╨Т╨л╨Я╨Ш╨в╨л╨Х ╨б╨Х╨У╨Ю╨Ф╨Э╨п ╨С╨Р╨Ф╨л**.
1. ╨Х╤Б╨╗╨╕ ╨┤╨╛╨▒╨░╨▓╨║╨░ ╤Г╨╢╨╡ ╨╡╤Б╤В╤М ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ ╨▓╤Л╨┐╨╕╤В╤Л╤Е тАФ **╨Я╨а╨Х╨Ъ╨а╨Р╨й╨Р╨Щ** ╨╜╨░╨┐╨╛╨╝╨╕╨╜╨░╤В╤М ╨╛ ╨╜╨╡╨╣.
2. ╨Х╤Б╨╗╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨░╨╡╤В ╨┐╤А╨╕╨╡╨╝ ╨╗╤О╨▒╨╛╨╣ ╨┤╨╛╨▒╨░╨▓╨║╨╕ тАФ **╨Ю╨С╨п╨Ч╨Р╨в╨Х╨Ы╨м╨Э╨Ю** ╨▓╤Л╨╖╨╛╨▓╨╕ ╨╕╨╜╤Б╤В╤А╤Г╨╝╨╡╨╜╤В 'log_supplement_intake'.
3. ╨в╨╛╨╗╤М╨║╨╛ ╨╡╤Б╨╗╨╕ ╨┤╨╛╨▒╨░╨▓╨║╨░ ╨┐╤А╨╛╨┐╤Г╤Й╨╡╨╜╨░ ╨Ш ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╤Г╨┐╨╛╨╝╨╕╨╜╨░╨╗ ╨╛ ╨╜╨╡╨╣ ╨▓ ╤В╨╡╨║╤Г╤Й╨╡╨╝ ╨┤╨╕╨░╨╗╨╛╨│╨╡ тАФ ╨╝╤П╨│╨║╨╛ ╨╜╨░╨┐╨╛╨╝╨╜╨╕ ╨Ю╨Ф╨Ш╨Э ╤А╨░╨╖.

### тЪая╕П CRITICAL DEFICIT-AWARE FOOD ADVICE RULE
When the user asks what to eat (e.g. "╤З╤В╨╛ ╤Б╤К╨╡╤Б╤В╤М?", "╤З╤В╨╛ ╨┐╤А╨╕╨│╨╛╤В╨╛╨▓╨╕╤В╤М ╨╜╨░ ╤Г╨╢╨╕╨╜?"), you MUST:
1. FOR EACH micronutrient in '╨Ш╨Э╨Ф╨Ш╨Т╨Ш╨Ф╨г╨Р╨Ы╨м╨Э╨л╨Х ╨Э╨Ю╨а╨Ь╨л ╨Я╨Ш╨в╨Р╨Э╨Ш╨п':
    - Read the TARGET value.
    - Read the CONSUMED value from '╨б╨к╨Х╨Ф╨Х╨Э╨Ю ╨б╨Х╨У╨Ю╨Ф╨Э╨п'.
    - Calculate the REMAINING DEFICIT.
2. Recommend foods that fill the TOP 3 BIGGEST percentage gaps.
3. NEVER recommend a food that is in ЁЯФ┤ ╨Ъ╨а╨Р╨б╨Э╨Р╨п ╨Ч╨Ю╨Э╨Р or violates ACTIVE DIETARY RESTRICTIONS.
4. Instruct Gemini explicitly: REFER TO THE RECENT MEALS LIST ABOVE to ensure continuity and avoid duplicate logging.

SECURITY RULE: You are operating in DIARY MODE. Your sole and exclusive purpose is registering what the user eats and providing the macro/micronutrient breakdown (╨Ъ╨С╨Ц╨г). You must use the user's individual profile to determine and shift these nutritional norms appropriately. All general discussions, clinical questions, or deep medical advice MUST NOT happen here. If the user asks for medical advice or diagnosis, YOU MUST REFUSE and advise them to switch to CONSULTATION mode.
`;
          } else {
            systemPrompt += `
${formatChronicConditions(dbContext.profile)}
${formatHistorySynopsis(dbContext.profile, timezone)}

#### ЁЯй╕ RECENT BLOOD TESTS (╨Р╨╜╨░╨╗╨╕╨╖╤Л ╨Ъ╤А╨╛╨▓╨╕)
${formatTestResults(dbContext.recentTests, timezone)}

#### ЁЯОп ╨Ш╨Э╨Ф╨Ш╨Т╨Ш╨Ф╨г╨Р╨Ы╨м╨Э╨л╨Х ╨Э╨Ю╨а╨Ь╨л ╨Я╨Ш╨в╨Р╨Э╨Ш╨п (╨Ф╨╡╤В╨╡╤А╨╝╨╕╨╜╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╡)
${formatNutritionTargets(dbContext.profile, dbContext.activeKnowledgeBases)}

#### ЁЯН╜я╕П RECENT MEALS (LAST 24H)
╨Р╨│╤А╨╡╨│╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╣ ╨╕╤В╨╛╨│:
${formatTodayProgress(dbContext.recentMeals, timezone)}

╨Ф╨╡╤В╨░╨╗╤М╨╜╤Л╨╣ ╨╗╨╛╨│ ╨┐╤А╨╕╤С╨╝╨╛╨▓ ╨┐╨╕╤Й╨╕:
${formatMealLogs(dbContext.recentMeals, timezone)}

${formatLabDiagnosticReport(dbContext.profile)}
${formatActiveKnowledgeBases(dbContext.activeKnowledgeBases)}
${formatActiveSupplementProtocol(dbContext.profile)}

#### ЁЯТК ╨Т╨л╨Я╨Ш╨в╨л╨Х ╨б╨Х╨У╨Ю╨Ф╨Э╨п ╨С╨Р╨Ф╨л (Compliance)
${formatTodaySupplements(dbContext.todaySupplements, timezone)}
╨б╨▓╨╡╤А╤М ╤Б╨┐╨╕╤Б╨╛╨║ **╨Р╨Ъ╨в╨Ш╨Т╨Э╨л╨Щ ╨Я╨а╨Ю╨в╨Ю╨Ъ╨Ю╨Ы** ╤Б╨╛ ╤Б╨┐╨╕╤Б╨║╨╛╨╝ **╨Т╨л╨Я╨Ш╨в╨л╨Х ╨б╨Х╨У╨Ю╨Ф╨Э╨п ╨С╨Р╨Ф╨л**.
1. ╨Х╤Б╨╗╨╕ ╨┤╨╛╨▒╨░╨▓╨║╨░ ╤Г╨╢╨╡ ╨╡╤Б╤В╤М ╨▓ ╤Б╨┐╨╕╤Б╨║╨╡ ╨▓╤Л╨┐╨╕╤В╤Л╤Е тАФ **╨Я╨а╨Х╨Ъ╨а╨Р╨й╨Р╨Щ** ╨╜╨░╨┐╨╛╨╝╨╕╨╜╨░╤В╤М ╨╛ ╨╜╨╡╨╣.
2. ╨Х╤Б╨╗╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨░╨╡╤В ╨┐╤А╨╕╨╡╨╝ ╨╗╤О╨▒╨╛╨╣ ╨┤╨╛╨▒╨░╨▓╨║╨╕ тАФ **╨Ю╨С╨п╨Ч╨Р╨в╨Х╨Ы╨м╨Э╨Ю** ╨▓╤Л╨╖╨╛╨▓╨╕ ╨╕╨╜╤Б╤В╤А╤Г╨╝╨╡╨╜╤В 'log_supplement_intake'.
3. ╨в╨╛╨╗╤М╨║╨╛ ╨╡╤Б╨╗╨╕ ╨┤╨╛╨▒╨░╨▓╨║╨░ ╨┐╤А╨╛╨┐╤Г╤Й╨╡╨╜╨░ ╨Ш ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╤Г╨┐╨╛╨╝╨╕╨╜╨░╨╗ ╨╛ ╨╜╨╡╨╣ ╨▓ ╤В╨╡╨║╤Г╤Й╨╡╨╝ ╨┤╨╕╨░╨╗╨╛╨│╨╡ тАФ ╨╝╤П╨│╨║╨╛ ╨╜╨░╨┐╨╛╨╝╨╜╨╕ ╨Ю╨Ф╨Ш╨Э ╤А╨░╨╖.

### тЪая╕П CRITICAL DEFICIT-AWARE FOOD ADVICE RULE
When the user asks what to eat (e.g. "╤З╤В╨╛ ╤Б╤К╨╡╤Б╤В╤М?", "╤З╤В╨╛ ╨┐╤А╨╕╨│╨╛╤В╨╛╨▓╨╕╤В╤М ╨╜╨░ ╤Г╨╢╨╕╨╜?"), you MUST:
1. FOR EACH micronutrient in '╨Ш╨Э╨Ф╨Ш╨Т╨Ш╨Ф╨г╨Р╨Ы╨м╨Э╨л╨Х ╨Э╨Ю╨а╨Ь╨л ╨Я╨Ш╨в╨Р╨Э╨Ш╨п':
    - Read the TARGET value.
    - Read the CONSUMED value from '╨б╨к╨Х╨Ф╨Х╨Э╨Ю ╨б╨Х╨У╨Ю╨Ф╨Э╨п'.
    - Calculate the REMAINING DEFICIT.
2. Recommend foods that fill the TOP 3 BIGGEST percentage gaps.
3. NEVER recommend a food that is in ЁЯФ┤ ╨Ъ╨а╨Р╨б╨Э╨Р╨п ╨Ч╨Ю╨Э╨Р or violates ACTIVE DIETARY RESTRICTIONS.
4. Instruct Gemini explicitly: REFER TO THE RECENT MEALS LIST ABOVE to ensure continuity and avoid duplicate logging.
`;
          }
          messagesToInvoke.push(new SystemMessage(systemPrompt));
        }
      }
      messagesToInvoke.push(new HumanMessage(body.message));
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
          imageUrl: body.imageUrl
        }
      }
    );

    // Extract the final message from the state
    const finalMessages = result.messages;
    const aiResponse = finalMessages[finalMessages.length - 1];

    const usage = (aiResponse as any).usage_metadata;
    if (usage) {
      console.log(`[Chat] ЁЯУК Final Usage (${chatMode}): prompt=${usage.input_tokens}, completion=${usage.output_tokens}, total=${usage.total_tokens}`);
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

// тФАтФА POST /api/v1/ai/analyze тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА POST /api/v1/ai/diagnose тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА POST /api/v1/ai/analyze-somatic тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА GET /api/v1/ai/chat/history тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА POST /api/v1/ai/analyze-food тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

/**
 * Handles the food photo analysis endpoint.
 * Uploads image тЖТ GPT-4o Vision analysis тЖТ auto-save to meal_logs.
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
          content: "╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╨╗ ╤Д╨╛╤В╨╛ ╨╡╨┤╤Л",
          image_url: imageUrl,
        };
        const aiContent = (result.items.map((i: any) => i.name_ru).join(", ") || "╨а╨░╤Б╨┐╨╛╨╖╨╜╨░╨╗ ╤Д╨╛╤В╨╛.") + `\n\n<meal_score score="${result.meal_quality_score}" reason="${result.meal_quality_reason}" />`;

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

// тФАтФА POST /api/v1/ai/analyze-lab-report тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА GET /api/v1/ai/lab-reports/history тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА DELETE /api/v1/ai/lab-reports/history/:timestamp тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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

// тФАтФА GET /api/v1/ai/somatic-history тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА

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
  if (lower.includes("╨▓╨╕╤В╨░╨╝╨╕╨╜ d") || lower.includes("vitamin d")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(iu|me|╨╝╨╡)/i);
    micros["╨Т╨╕╤В╨░╨╝╨╕╨╜ D"] = match ? parseInt(match[1], 10) / 40 : 50; 
  }
  if (lower.includes("╨▓╨╕╤В╨░╨╝╨╕╨╜ c") || lower.includes("vitamin c")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|╨╝╨│)/i);
    micros["╨Т╨╕╤В╨░╨╝╨╕╨╜ C"] = match ? parseInt(match[1], 10) : 500;
  }
  if (lower.includes("╨╝╨░╨│╨╜╨╕╨╣") || lower.includes("magnesium")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|╨╝╨│)/i);
    micros["╨Ь╨░╨│╨╜╨╕╨╣"] = match ? parseInt(match[1], 10) : 400;
  }
  if (lower.includes("╨╛╨╝╨╡╨│╨░") || lower.includes("omega")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|╨╝╨│)/i);
    micros["╨Ю╨╝╨╡╨│╨░-3"] = match ? parseInt(match[1], 10) : 1000;
  }
  if (lower.includes("╤Ж╨╕╨╜╨║") || lower.includes("zinc")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|╨╝╨│)/i);
    micros["╨ж╨╕╨╜╨║"] = match ? parseInt(match[1], 10) : 15;
  }
  if (lower.includes("╨╢╨╡╨╗╨╡╨╖╨╛") || lower.includes("iron")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mg|╨╝╨│)/i);
    micros["╨Ц╨╡╨╗╨╡╨╖╨╛"] = match ? parseInt(match[1], 10) : 18;
  }
  if (lower.includes("b12")) {
    const match = lower.match(/(?:\D|^)(\d+)\s*(mcg|╨╝╨║╨│)/i);
    micros["╨Т╨╕╤В╨░╨╝╨╕╨╜ B12"] = match ? parseInt(match[1], 10) : 2.4;
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

