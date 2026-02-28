"use client";

import { useState } from "react";
import Image from "next/image";

import { type SomaticHistoryItem } from "@/lib/api-client";

interface SomaticAnalysisCardProps {
    title: string;
    items: SomaticHistoryItem[];
    onDismiss?: () => void;
}

/** Marker severity color mapping for visual chips. */
function getMarkerColor(index: number): string {
    const colors = [
        "bg-amber-100 text-amber-800 border-amber-200",
        "bg-rose-100 text-rose-800 border-rose-200",
        "bg-violet-100 text-violet-800 border-violet-200",
        "bg-sky-100 text-sky-800 border-sky-200",
        "bg-emerald-100 text-emerald-800 border-emerald-200",
        "bg-orange-100 text-orange-800 border-orange-200",
    ];
    return colors[index % colors.length];
}

/**
 * Displays somatic vision analysis results with photo preview,
 * detected markers as colored chips, and AI interpretation text.
 */
export default function SomaticAnalysisCard({ title, items, onDismiss }: SomaticAnalysisCardProps) {
    const [isZoomed, setIsZoomed] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    if (!items || items.length === 0) return null;

    const currentItem = items[selectedIndex];
    if (!currentItem) return null;

    // Support both old flat format and new nested format 
    const isFlat = !('analysis' in currentItem) && ('markers' in currentItem);
    const result = isFlat ? (currentItem as any) : currentItem.analysis;
    const imageUrl = isFlat ? (currentItem as any).imageUrl : currentItem.imageUrl;

    if (!result) return null; // Safe fallback if completely malformed

    const confidencePercent = Math.round((result.confidence || 0) * 100);
    const confidenceColor =
        confidencePercent >= 70
            ? "text-success"
            : confidencePercent >= 40
                ? "text-amber-600"
                : "text-error";

    return (
        <>
            <div className="rounded-2xl border border-divider bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-violet-50 px-5 py-3 border-b border-divider">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🔬</span>
                        <h3 className="text-sm font-semibold text-ink">{title}</h3>
                        <span className={`text-xs font-medium ${confidenceColor}`}>
                            {confidencePercent}% уверенности
                        </span>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="rounded-lg p-1 text-ink-muted hover:bg-white/60 hover:text-ink transition-colors"
                            aria-label="Закрыть"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-4">
                    {/* Date History Switcher */}
                    {items.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {items.map((item, idx) => {
                                const d = new Date(item.timestamp);
                                const dateStr = d.toLocaleDateString("ru-RU", { day: 'numeric', month: 'short' });
                                const timeStr = d.toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' });
                                const isSelected = idx === selectedIndex;
                                return (
                                    <button
                                        key={item.timestamp + idx}
                                        onClick={() => setSelectedIndex(idx)}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isSelected
                                            ? "bg-violet-100 text-violet-800 border-violet-200 border"
                                            : "bg-surface bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
                                            }`}
                                    >
                                        {idx === 0 ? "Свежий" : `${dateStr} ${timeStr}`}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Photo Preview + Markers Row */}
                    <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div
                            className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden border border-cloud cursor-zoom-in group shadow-sm"
                            onClick={() => setIsZoomed(true)}
                        >
                            <Image
                                src={imageUrl}
                                alt={title}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                            </div>
                        </div>

                        {/* Markers */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-ink-muted mb-2">Обнаруженные маркеры</p>
                            {result?.markers?.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {result.markers.map((marker: string, i: number) => (
                                        <span
                                            key={marker}
                                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getMarkerColor(i)}`}
                                        >
                                            {marker}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-success font-medium">
                                    ✓ Видимых отклонений не обнаружено
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Interpretation */}
                    <div className="rounded-xl bg-surface-muted p-4">
                        <p className="text-xs font-medium text-ink-muted mb-1.5">Интерпретация ИИ</p>
                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                            {result.interpretation}
                        </p>
                    </div>
                </div>
            </div>

            {/* Fullscreen Zoom Modal */}
            {isZoomed && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setIsZoomed(false)}
                >
                    <div className="relative w-full max-w-3xl max-h-[90vh]">
                        <img
                            src={imageUrl}
                            alt={`${title} (увеличенное)`}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-zoom-out mx-auto"
                        />
                        <button
                            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsZoomed(false);
                            }}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
