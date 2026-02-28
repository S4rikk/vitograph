/**
 * Test runner for AI Trigger Services.
 *
 * Demonstrates all 3 AI functions returning valid data
 * (or valid fallbacks if OPENAI_API_KEY is not set).
 *
 * Usage: npx tsx src/test-ai.ts
 */

import "dotenv/config";

import {
  generatePsychologicalResponse,
  analyzeSymptomCorrelation,
  generateDiagnosticHypothesis,
} from "./ai-triggers.js";
import type {
  FoodContext,
  UserProfileContext,
  SymptomEntry,
  ExistingBiomarker,
} from "./ai-triggers.js";

// ── Test data ───────────────────────────────────────────────────────

const testFood: FoodContext = {
  name: "Шоколадный торт",
  category: "dessert",
  glycemicIndex: 70,
  commonAllergens: ["gluten", "dairy", "eggs"],
  caloriesPer100g: 370,
};

const testUser: UserProfileContext = {
  userId: "test-user-001",
  biologicalSex: "female",
  dietType: "Mediterranean",
  chronicConditions: ["pre-diabetes", "IBS"],
  activityLevel: "moderate",
};

const testSymptoms: SymptomEntry[] = [
  { foodName: "Молоко", symptomName: "Вздутие", severity: 7, onsetDelayMinutes: 45, loggedAt: "2026-02-15T10:00:00Z" },
  { foodName: "Молоко", symptomName: "Вздутие", severity: 6, onsetDelayMinutes: 60, loggedAt: "2026-02-13T08:30:00Z" },
  { foodName: "Молоко", symptomName: "Вздутие", severity: 8, onsetDelayMinutes: 30, loggedAt: "2026-02-10T12:00:00Z" },
  { foodName: "Молоко", symptomName: "Газообразование", severity: 5, onsetDelayMinutes: 50, loggedAt: "2026-02-12T09:00:00Z" },
  { foodName: "Хлеб белый", symptomName: "Усталость", severity: 4, onsetDelayMinutes: 90, loggedAt: "2026-02-14T13:00:00Z" },
  { foodName: "Хлеб белый", symptomName: "Brain fog", severity: 6, onsetDelayMinutes: 120, loggedAt: "2026-02-11T14:00:00Z" },
  { foodName: "Пицца", symptomName: "Изжога", severity: 7, onsetDelayMinutes: 20, loggedAt: "2026-02-09T19:00:00Z" },
];

const testBiomarkers: ExistingBiomarker[] = [
  { code: "HBA1C", name: "Гликированный гемоглобин", value: 5.9 },
  { code: "CRP", name: "С-реактивный белок", value: 3.2 },
];

// ── Helpers ─────────────────────────────────────────────────────────

function separator(title: string): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const hasKey = Boolean(process.env["OPENAI_API_KEY"]);
  console.log(`OPENAI_API_KEY: ${hasKey ? "✅ set" : "❌ not set (fallbacks will be used)"}`);

  // ── Test 1: Psychological Response (Sync) ───────────────────────
  separator("Test 1: generatePsychologicalResponse (SYNC)");
  const psych = await generatePsychologicalResponse(testFood, testUser);
  console.log("Strategy:", psych.strategy);
  console.log("Message:", psych.message);
  console.log("Alternatives:", psych.alternatives);
  console.log("Confidence:", psych.confidence);

  // ── Test 2: Symptom Correlation (Async) ─────────────────────────
  separator("Test 2: analyzeSymptomCorrelation (ASYNC)");
  const corr = await analyzeSymptomCorrelation(testSymptoms);
  console.log("Correlations found:", corr.correlations.length);
  for (const c of corr.correlations) {
    console.log(
      `  • ${c.foodName} → ${c.symptomName} ` +
        `(${c.occurrenceCount}x, confidence: ${c.confidence})`,
    );
  }
  console.log("Confounding factors:", corr.confoundingFactors);
  console.log("Data quality:", corr.dataQualityNote);

  // ── Test 3: Diagnostic Hypothesis (Async) ───────────────────────
  separator("Test 3: generateDiagnosticHypothesis (ASYNC)");
  const diag = await generateDiagnosticHypothesis(testSymptoms, testBiomarkers);
  console.log("Hypotheses found:", diag.hypotheses.length);
  for (const h of diag.hypotheses) {
    console.log(`  • ${h.hypothesis} [${h.evidenceLevel}]`);
    console.log(`    Reasoning: ${h.reasoning.slice(0, 120)}...`);
    for (const t of h.recommendedTests) {
      console.log(
        `    → Test: ${t.testName} (${t.biomarkerCode}) [${t.priority}]`,
      );
    }
  }

  separator("ALL TESTS COMPLETED ✅");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
