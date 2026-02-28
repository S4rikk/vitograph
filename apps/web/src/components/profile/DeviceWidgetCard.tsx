"use client";

import { ReactNode } from "react";
import { Pencil, Camera } from "lucide-react";
import type { MetricItem } from "@/types/wearable-types";

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
}: DeviceWidgetCardProps) {
    const hasAnyData = metrics.some(
        (m) => m.value !== null && m.value !== undefined && m.value !== "",
    );

    const displayStatus = statusText ?? (hasAnyData ? "Обновлено" : "Нет данных");

    return (
        <div className="flex flex-col rounded-2xl border border-divider bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-primary-100 group">
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 shrink-0">
                        {icon}
                    </div>
                    <div>
                        <h4 className="text-[15px] font-semibold text-ink-main leading-tight">
                            {title}
                        </h4>
                        <p
                            className={`text-xs font-medium mt-0.5 ${hasAnyData ? "text-success" : "text-ink-muted"
                                }`}
                        >
                            {displayStatus}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Metrics Grid ── */}
            <div className="flex-1 mb-4 space-y-2">
                {metrics.map((metric) => {
                    const isEmpty =
                        metric.value === null ||
                        metric.value === undefined ||
                        metric.value === "";

                    return (
                        <div
                            key={metric.label}
                            className="flex items-center justify-between py-1.5 border-b border-divider/50 last:border-b-0"
                        >
                            <span className="text-[13px] text-ink-muted font-medium truncate mr-2">
                                {metric.label}
                            </span>
                            <div className="flex items-baseline gap-1 shrink-0">
                                <span
                                    className={`text-sm font-semibold ${isEmpty ? "text-ink-muted/50" : "text-ink-main"
                                        }`}
                                >
                                    {isEmpty ? "—" : metric.value}
                                </span>
                                {!isEmpty && metric.unit && (
                                    <span className="text-[11px] text-ink-muted font-medium">
                                        {metric.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer / Actions ── */}
            <div className="flex items-center gap-2 mt-auto pt-3 border-t border-divider">
                <button
                    onClick={onManualEntry}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-muted px-3 py-2 text-[13px] font-semibold text-ink-main transition-colors hover:bg-surface-hover active:scale-95 cursor-pointer"
                >
                    <Pencil size={14} />
                    Ввести вручную
                </button>
                <button
                    onClick={onScreenshotUpload}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-divider bg-white px-3 py-2 text-[13px] font-semibold text-primary-600 shadow-sm transition-colors hover:bg-primary-50 hover:border-primary-100 active:scale-95 cursor-pointer"
                >
                    <Camera size={14} />
                    Скриншот
                </button>
            </div>
        </div>
    );
}
