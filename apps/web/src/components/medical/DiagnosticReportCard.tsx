"use client";

import type { LabDiagnosticReport } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { 
    ClipboardList, 
    Microscope, 
    Search, 
    Target, 
    Stethoscope, 
    Apple, 
    AlertCircle, 
    AlertTriangle, 
    CheckCircle2 
} from "lucide-react";

/* ── Color Maps ──────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
    critical_low: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    critical_high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    low: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    normal: "bg-teal-500/10 text-teal-300 border-teal-500/20",
};

const SEVERITY_BORDER: Record<string, string> = {
    significant: "border-l-red-500",
    moderate: "border-l-orange-400",
    mild: "border-l-yellow-400",
};

const PRIORITY_BADGE: Record<string, { icon: React.ReactNode; color: string }> = {
    urgent: { icon: <AlertCircle className="w-3 h-3" />, color: "bg-red-100 text-red-800" },
    important: { icon: <AlertTriangle className="w-3 h-3" />, color: "bg-amber-100 text-amber-800" },
    routine: { icon: <CheckCircle2 className="w-3 h-3" />, color: "bg-green-100 text-green-700" },
};

/* ── Component ───────────────────────────────────────────────── */

type DiagnosticReportCardProps = {
    readonly report: LabDiagnosticReport;
};

/**
 * Renders a structured diagnostic report from GPT-5.4 analysis.
 *
 * Sections: summary, biomarker assessments, diagnostic patterns,
 * priority actions, additional tests, dietary recommendations, disclaimer.
 */
export default function DiagnosticReportCard({ report }: DiagnosticReportCardProps) {
    const t = useTranslations("medical");

    return (
        <div className="space-y-6 rounded-2xl border border-white/70 dark:border-white/30 bg-surface/80 backdrop-blur-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_1px_0_2px_rgba(255,255,255,0.5),inset_-1px_0_2px_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(255,255,255,0.2),0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_1px_0_2px_rgba(255,255,255,0.15),inset_-1px_0_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05),0_10px_20px_-10px_rgba(0,0,0,0.5)] p-6">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-purple-100 p-3">
                    <ClipboardList className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-ink">
                        {t("diagnosticReportTitle")}
                    </h3>
                    <p className="text-xs text-ink-muted">{t("premiumAnalysis")}</p>
                </div>
            </div>

            {/* ── Summary ─────────────────────────────────────────── */}
            <div className="rounded-xl bg-primary-500/10 p-4">
                <p className="text-sm leading-relaxed text-ink">{report.summary}</p>
            </div>

            {/* ── Biomarker Assessments ───────────────────────────── */}
            {report.biomarker_assessments.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <Microscope className="w-4 h-4 text-ink-muted" /> {t("markersAssessment")}
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {report.biomarker_assessments.map((b, i) => (
                            <div
                                key={i}
                                className={`rounded-lg border p-3 ${STATUS_COLORS[b.status] ?? STATUS_COLORS.normal}`}
                            >
                                <div className="flex items-baseline justify-between">
                                    <span className="text-sm font-medium">{b.name}</span>
                                    <span className="text-xs font-mono">
                                        {b.value} {b.unit}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs opacity-70">
                                    {t("refLabel")} {b.reference_range}
                                </p>
                                <p className="mt-1 text-xs leading-snug">
                                    {b.clinical_significance}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Diagnostic Patterns ─────────────────────────────── */}
            {report.diagnostic_patterns.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <Search className="w-4 h-4 text-ink-muted" /> {t("identifiedPatterns")}
                    </h4>
                    <div className="space-y-3">
                        {report.diagnostic_patterns.map((p, i) => (
                            <div
                                key={i}
                                className={`rounded-lg border border-l-4 bg-surface p-4 shadow-xs ${SEVERITY_BORDER[p.severity] ?? ""}`}
                            >
                                <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-semibold text-ink">
                                        {p.pattern_name}
                                    </h5>
                                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                                        {p.severity}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-ink-muted">
                                    {t("markersLabel")} {p.involved_markers.join(", ")}
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-ink">
                                    {p.explanation}
                                </p>
                                {p.recommendations.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {p.recommendations.map((r, j) => (
                                            <li key={j} className="text-xs text-ink-muted">
                                                → {r}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Priority Actions ───────────────────────────────── */}
            {report.priority_actions.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <Target className="w-4 h-4 text-ink-muted" /> {t("priorityActions")}
                    </h4>
                    <div className="space-y-2">
                        {report.priority_actions.map((a, i) => {
                            const badge = PRIORITY_BADGE[a.priority] ?? PRIORITY_BADGE.routine;
                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
                                >
                                    <span
                                        className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 ${badge.color}`}
                                    >
                                        {badge.icon} {a.priority}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink">{a.action}</p>
                                        <p className="mt-0.5 text-xs text-ink-muted">{a.reasoning}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Recommended Additional Tests ────────────────────── */}
            {report.recommended_additional_tests.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <Stethoscope className="w-4 h-4 text-ink-muted" /> {t("recommendedTests")}
                    </h4>
                    <ul className="space-y-2">
                        {report.recommended_additional_tests.map((t, i) => (
                            <li
                                key={i}
                                className="rounded-lg border border-border bg-surface-muted p-3"
                            >
                                <p className="text-sm font-medium text-ink">{t.test_name}</p>
                                <p className="mt-0.5 text-xs text-ink-muted">{t.reason}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Dietary Recommendations ─────────────────────────── */}
            {report.dietary_recommendations.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <Apple className="w-4 h-4 text-ink-muted" /> {t("dietaryRecommendations")}
                    </h4>
                    <ul className="space-y-2">
                        {report.dietary_recommendations.map((d, i) => (
                            <li
                                key={i}
                                className="rounded-lg border border-border bg-surface p-3"
                            >
                                <p className="text-sm text-ink">{d.recommendation}</p>
                                <p className="mt-1 text-xs text-ink-muted">
                                    {t("targetMarkersLabel")} {d.target_markers.join(", ")}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Disclaimer ─────────────────────────────────────── */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs leading-relaxed text-amber-800">
                    {report.disclaimer}
                </p>
            </div>
        </div>
    );
}
