"use client";

import { ReactNode } from "react";
import { Pencil, Camera } from "lucide-react";
import type { MetricItem } from "@/types/wearable-types";
import { useTranslations } from "next-intl";

interface DeviceWidgetCardProps {
    /** Card title (e.g. "Sleep & Recovery"). */
    title: string;
    /** SVG icon node rendered in the header badge. */
    icon: ReactNode;
    /** Array of metrics to display in the card body. */
    metrics: MetricItem[];
    /** Optional status text (e.g. "Обновлено сегодня"). */
    statusText?: string;
    /** Callback when "Ввести вручную" is clicked. */
    onManualEntry?: () => void;
    /** Callback when "Скриншот" is clicked. */
    onScreenshotUpload?: () => void;
    /** Whether an image upload/OCR is in progress. */
    isUploading?: boolean;
}

/**
 * Determines the CSS color class for the trend arrow.
 * Uses medical rules for specific metrics.
 */
function getTrendColor(metricId: string, currentValue: number): string {
    // Сон: нормальный диапазон 7-9 часов. За пределами — красный.
    if (metricId === "sleepDurationHours") {
        return (currentValue < 7 || currentValue > 9) ? "text-error" : "text-success";
    }
    // Для всех остальных метрик — нейтральный серый
    return "text-ink-faint";
}

/**
 * Wearable device metric card for the Wearables Hub.
 *
 * Displays an array of metric rows (label + value + unit)
 * with action buttons for manual data entry and screenshot upload.
 */
export default function DeviceWidgetCard({
    title,
    icon,
    metrics,
    statusText,
    onManualEntry,
    onScreenshotUpload,
    isUploading,
}: DeviceWidgetCardProps) {
    const t = useTranslations("profile");
    const hasAnyData = metrics.some(
        (m) => m.value !== null && m.value !== undefined && m.value !== "",
    );

    const displayStatus = statusText ?? (hasAnyData ? t("updated") : t("noData"));

    return (
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-2.5 shadow-sm transition-all hover:shadow-md hover:border-primary-100 group">
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 shrink-0">
                        {icon}
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-ink leading-tight">
                            {title}
                        </h4>
                        <p
                            className={`text-[0.6875rem] font-medium mt-0 ${hasAnyData ? "text-success" : "text-ink-muted"
                                }`}
                        >
                            {displayStatus}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Metrics Grid ── */}
            <div className="flex-1 mb-1">
                {metrics.map((metric) => {
                    const isEmpty =
                        metric.value === null ||
                        metric.value === undefined ||
                        metric.value === "";
                    const hasHistory = metric.history && metric.history.length > 0;

                    // 1. Убираем дубликаты (одинаковые значения идущие подряд)
                    const uniqueHistory = hasHistory
                        ? metric.history!.filter((h, i, arr) =>
                            i === 0 || h.value !== arr[i - 1].value
                        )
                        : [];
                    const hasUniqueHistory = uniqueHistory.length > 0;

                    // 2. ── Trend arrow with smart color (основан на оригинальной истории, не на uniqueHistory) ──
                    let trendArrow: React.ReactNode = null;
                    if (hasHistory && !isEmpty && typeof metric.value === 'number') {
                        const prev = metric.history![0].value;
                        if (prev !== null) {
                            const colorClass = getTrendColor(metric.id, metric.value);
                            if (metric.value > prev) {
                                trendArrow = <span className={`text-sm ${colorClass}`}>↗</span>;
                            } else if (metric.value < prev) {
                                trendArrow = <span className={`text-sm ${colorClass}`}>↘</span>;
                            }
                        }
                    }

                    return (
                        <div key={metric.label} className="border-b border-border/50 last:border-b-0 py-0.5">
                            {/* ── Label + Value Row ── */}
                            <div className="flex items-baseline justify-between mb-0">
                                <span className="text-[0.6875rem] text-ink-muted font-medium truncate mr-2">
                                    {metric.label}
                                </span>
                                <div className="flex items-baseline gap-1 shrink-0">
                                    <span
                                        className={`text-sm font-bold ${
                                            isEmpty ? "text-ink-muted/40" : "text-primary-700"
                                        }`}
                                    >
                                        {isEmpty ? "—" : metric.value}
                                    </span>
                                    {!isEmpty && metric.unit && (
                                        <span className="text-[0.625rem] text-primary-700/70 font-semibold">
                                            {metric.unit}
                                        </span>
                                    )}
                                    {trendArrow}
                                </div>
                            </div>

                            {/* ── History Text (ALWAYS VISIBLE) ── */}
                            {hasUniqueHistory && (
                                <div className="text-[0.625rem] text-ink-faint leading-relaxed mt-0">
                                    {[...uniqueHistory].reverse().map((h, i) => (
                                        <span key={i}>
                                            {i > 0 && (
                                                <span className="mx-1.5">|</span>
                                            )}
                                            <span className="font-medium">
                                                {new Date(h.date).toLocaleDateString("ru-RU", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                })}
                                            </span>
                                            <span className="mx-1">→</span>
                                            <span>
                                                {metric.historyValueFormatter && h.value !== null
                                                    ? metric.historyValueFormatter(h.value)
                                                    : `${h.value}${metric.unit ? ` ${metric.unit}` : ""}`
                                                }
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer / Actions ── */}
            <div className="flex items-center gap-1.5 mt-auto pt-1.5 border-t border-border">
                <button
                    onClick={onManualEntry}
                    className="flex-1 flex min-w-0 items-center justify-center gap-1 rounded-lg bg-surface-muted px-2 py-1.5 text-[0.6875rem] font-semibold text-ink transition-colors hover:bg-surface-hover active:scale-95 cursor-pointer"
                >
                    <Pencil size={12} className="shrink-0" />
                    <span className="truncate">{t("manualEntry")}</span>
                </button>
                {onScreenshotUpload && (
                    <button
                        onClick={onScreenshotUpload}
                        disabled={isUploading}
                        className="flex-1 flex min-w-0 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-[0.6875rem] font-semibold text-primary-600 shadow-sm transition-colors hover:bg-primary-50 hover:border-primary-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isUploading ? (
                            <svg className="animate-spin h-3.5 w-3.5 text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <Camera size={12} className="shrink-0" />
                        )}
                        <span className="truncate">{isUploading ? "..." : t("screenshot")}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
