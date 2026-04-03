/**
 * Lab Report Analyzer — GPT-5.4 premium diagnostics.
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
import { LAB_DIAGNOSTIC_PROMPT } from "../prompts/lab-diagnostic.prompt.js";
import { validateLabReport } from "../validators/response-validator.js";

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

/** Timeout for GPT-5.4 analysis (2 minutes — for stable medical analysis). */
const LAB_ANALYSIS_TIMEOUT_MS = 120_000;

/** Temperature for clinical precision. */
const LAB_ANALYSIS_TEMPERATURE = 0.2;

/** Model for premium diagnostics. */
const LAB_ANALYSIS_MODEL = "gpt-5.4-mini"; // Switched from router to official OpenAI 2026-03-29

// ── System Prompt (imported from prompts registry) ──────────────────
// See: prompts/lab-diagnostic.prompt.ts for the full 7-stage CoT prompt.

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

/**
 * Maps a biomarker flag (Low/High/Normal/null) to the Zod status enum value.
 */
function mapFlagToStatus(flag: string | null | undefined): "critical_low" | "low" | "normal" | "high" | "critical_high" {
    if (!flag) return "normal";
    const f = flag.toLowerCase();
    if (f === "low") return "low";
    if (f === "high") return "high";
    return "normal";
}

/**
 * Lookup cached clinical notes for biomarkers by slug + flag.
 * Returns a Map<string, string> where key = "slug::flag" and value = clinical_note.
 */
async function lookupCachedNotes(
    supabase: ReturnType<typeof createClient>,
    biomarkers: BiomarkerInput[],
): Promise<Map<string, string>> {
    const cache = new Map<string, string>();

    const slugs = [...new Set(
        biomarkers
            .filter((b) => b.standardized_slug && b.flag)
            .map((b) => b.standardized_slug),
    )];

    if (slugs.length === 0) return cache;

    const { data, error } = await supabase
        .from("biomarker_note_cache")
        .select("standardized_slug, flag, clinical_note")
        .in("standardized_slug", slugs);

    if (error) {
        console.error("[NoteCache] Lookup failed (non-fatal):", error.message);
        return cache;
    }

    if (data) {
        for (const row of data) {
            cache.set(`${row.standardized_slug}::${row.flag}`, row.clinical_note);
        }
    }

    return cache;
}

/**
 * Save new assessment notes to the deterministic cache (best-effort, non-blocking).
 */
async function saveCachedNotes(
    supabase: ReturnType<typeof createClient>,
    entries: Array<{ slug: string; flag: string; note: string }>,
): Promise<void> {
    if (entries.length === 0) return;

    try {
        await supabase
            .from("biomarker_note_cache")
            .upsert(
                entries.map((e) => ({
                    standardized_slug: e.slug,
                    flag: e.flag,
                    clinical_note: e.note,
                })),
                { onConflict: "standardized_slug,flag" },
            );
    } catch (err) {
        console.error("[NoteCache] Save failed (non-fatal):", err);
    }
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

    // ── Deterministic Note Cache ─────────────────────────────────────
    const noteCache = supabase
        ? await lookupCachedNotes(supabase, biomarkerResults)
        : new Map<string, string>();

    const cachedAssessments: Array<{
        name: string;
        value: number;
        unit: string;
        reference_range: string;
        status: "critical_low" | "low" | "normal" | "high" | "critical_high";
        clinical_significance: string;
    }> = [];
    const uncachedBiomarkers: BiomarkerInput[] = [];

    for (const bm of biomarkerResults) {
        const key = `${bm.standardized_slug}::${bm.flag}`;
        const cached = noteCache.get(key);

        if (cached) {
            cachedAssessments.push({
                name: bm.original_name,
                value: bm.value_numeric ?? 0,
                unit: bm.unit ?? "",
                reference_range: "",
                status: mapFlagToStatus(bm.flag),
                clinical_significance: cached,
            });
        } else {
            uncachedBiomarkers.push(bm);
        }
    }

    // ── Build LLM prompt ─────────────────────────────────────────────
    let userMessage = formatBiomarkersForLLM(biomarkerResults);

    if (cachedAssessments.length > 0) {
        const cachedNames = cachedAssessments.map((a) => a.name).join(", ");
        userMessage += `\n\nВАЖНО: Для следующих показателей индивидуальная оценка (biomarker_assessment) УЖЕ ГОТОВА и будет подставлена автоматически. НЕ генерируй для них поле clinical_significance, просто напиши "см. кэш". Используй их данные ТОЛЬКО для паттерн-анализа и рекомендаций. Показатели: ${cachedNames}`;
    }

    console.log(
        `[LabAnalyzer] Cache: ${cachedAssessments.length} hits, ` +
        `${uncachedBiomarkers.length} misses out of ${biomarkerResults.length} total`,
    );

    // ── Run LLM Analysis ─────────────────────────────────────────────
    const result = await callLlmStructured({
        schema: LabDiagnosticReportSchema,
        schemaName: "lab_diagnostic_report",
        systemPrompt: LAB_DIAGNOSTIC_PROMPT.template.replace("{userContext}", userContext),
        userMessage,
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

    // ── Merge cached + LLM assessments ──────────────────────────────
    const llmAssessments = result.data.biomarker_assessments || [];
    const mergedAssessments = [
        ...cachedAssessments,
        ...llmAssessments.filter((a) => a.clinical_significance !== "см. кэш"),
    ];
    result.data.biomarker_assessments = mergedAssessments;

    // ── Post-LLM validation (non-blocking, logging only) ────────────
    const validation = validateLabReport(result.data, biomarkerResults.length);
    if (!validation.isValid) {
        console.warn(`[AI:LabAnalyzer] ⚠️ Validation issues: ${validation.issues.join(", ")}`);
    }

    // ── Save newly generated assessments to cache ───────────────────
    if (supabase) {
        const newEntries = llmAssessments
            .filter((a) => a.clinical_significance && a.clinical_significance !== "см. кэш")
            .map((a) => {
                const original = biomarkerResults.find(
                    (bm) => bm.original_name === a.name,
                );
                if (!original?.standardized_slug || !original?.flag) return null;
                return {
                    slug: original.standardized_slug,
                    flag: original.flag,
                    note: a.clinical_significance,
                };
            })
            .filter(Boolean) as Array<{ slug: string; flag: string; note: string }>;

        saveCachedNotes(supabase, newEntries).catch(() => {});
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
