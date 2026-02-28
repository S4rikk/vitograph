"use client";

import type { LabDiagnosticReport } from "@/lib/api-client";

/* ── Color Maps ──────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
    critical_low: "bg-red-100 text-red-800 border-red-300",
    critical_high: "bg-red-100 text-red-800 border-red-300",
    low: "bg-amber-50 text-amber-800 border-amber-300",
    high: "bg-amber-50 text-amber-800 border-amber-300",
    normal: "bg-green-50 text-green-700 border-green-300",
};

const SEVERITY_BORDER: Record<string, string> = {
    significant: "border-l-red-500",
    moderate: "border-l-orange-400",
    mild: "border-l-yellow-400",
};

const PRIORITY_BADGE: Record<string, { icon: string; color: string }> = {
    urgent: { icon: "🔴", color: "bg-red-100 text-red-800" },
    important: { icon: "🟡", color: "bg-amber-100 text-amber-800" },
    routine: { icon: "🟢", color: "bg-green-100 text-green-700" },
};

/* ── Component ───────────────────────────────────────────────── */

type DiagnosticReportCardProps = {
    readonly report: LabDiagnosticReport;
};

/**
 * Renders a structured diagnostic report from GPT-5.2 analysis.
 *
 * Sections: summary, biomarker assessments, diagnostic patterns,
 * priority actions, additional tests, dietary recommendations, disclaimer.
 */
export default function DiagnosticReportCard({ report }: DiagnosticReportCardProps) {
    return (
        <div className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-purple-100 p-3">
                    <span className="text-2xl">📋</span>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-ink">
                        Диагностический отчёт
                    </h3>
                    <p className="text-xs text-ink-muted">GPT-5.2 · Премиум-анализ</p>
                </div>
            </div>

            {/* ── Summary ─────────────────────────────────────────── */}
            <div className="rounded-xl bg-primary-50 p-4">
                <p className="text-sm leading-relaxed text-ink">{report.summary}</p>
            </div>

            {/* ── Biomarker Assessments ───────────────────────────── */}
            {report.biomarker_assessments.length > 0 && (
                <section>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                        <span>🔬</span> Оценка показателей
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
                                <p className="mt-1 text-xs opacity-80">
                                    Реф.: {b.reference_range}
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
                        <span>🔍</span> Выявленные паттерны
                    </h4>
                    <div className="space-y-3">
                        {report.diagnostic_patterns.map((p, i) => (
                            <div
                                key={i}
                                className={`rounded-lg border border-l-4 bg-white p-4 shadow-xs ${SEVERITY_BORDER[p.severity] ?? ""}`}
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
                                    Маркеры: {p.involved_markers.join(", ")}
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
                        <span>🎯</span> Приоритетные действия
                    </h4>
                    <div className="space-y-2">
                        {report.priority_actions.map((a, i) => {
                            const badge = PRIORITY_BADGE[a.priority] ?? PRIORITY_BADGE.routine;
                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 rounded-lg border border-border bg-white p-3"
                                >
                                    <span
                                        className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
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
                        <span>⚕️</span> Рекомендуемые допол. анализы
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
                        <span>🥗</span> Диетарные рекомендации
                    </h4>
                    <ul className="space-y-2">
                        {report.dietary_recommendations.map((d, i) => (
                            <li
                                key={i}
                                className="rounded-lg border border-border bg-white p-3"
                            >
                                <p className="text-sm text-ink">{d.recommendation}</p>
                                <p className="mt-1 text-xs text-ink-muted">
                                    Целевые маркеры: {d.target_markers.join(", ")}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Disclaimer ─────────────────────────────────────── */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs leading-relaxed text-amber-800">
                    {report.disclaimer}
                </p>
            </div>
        </div>
    );
}
