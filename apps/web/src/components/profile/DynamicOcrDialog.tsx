"use client";
import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Activity } from "lucide-react";
import type { DynamicWearableResult, DynamicWearableMetric } from "@/lib/api-client";

interface DynamicOcrDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ocrResult: DynamicWearableResult | null;
    onSave: (payload: DynamicWearableResult) => Promise<void>;
}

export default function DynamicOcrDialog({ isOpen, onClose, ocrResult, onSave }: DynamicOcrDialogProps) {
    const [metrics, setMetrics] = useState<DynamicWearableMetric[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && ocrResult) {
            // Limit to max 15 items to prevent UI overflow/hallucinations
            setMetrics(ocrResult.extractedMetrics.slice(0, 15));
        }
    }, [isOpen, ocrResult]);

    if (!isOpen || !ocrResult) return null;

    const handleDelete = (index: number) => {
        setMetrics(prev => prev.filter((_, i) => i !== index));
    };

    const handleValueChange = (index: number, newValue: string) => {
        setMetrics(prev => {
            const newMetrics = [...prev];
            newMetrics[index] = { ...newMetrics[index], rawValue: newValue };
            return newMetrics;
        });
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await onSave({ ...ocrResult, extractedMetrics: metrics });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-surface w-full sm:rounded-3xl rounded-t-3xl max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
                    <div>
                        <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary-500" />
                            Review Scanned Data
                        </h3>
                        <p className="text-sm text-ink-muted mt-1">
                            Edit or delete any incorrect values before saving.
                        </p>
                        <p className="text-sm font-medium text-primary-600 bg-primary-50 dark:bg-primary-500/10 p-3 rounded-lg mt-3 border border-primary-100 dark:border-primary-500/20">
                            ✨ ИИ успешно распознал данные! Пожалуйста, проверьте и при необходимости отредактируйте цифры перед сохранением.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-ink-muted hover:bg-surface-hover rounded-full transition-colors cursor-pointer self-start"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {metrics.length === 0 ? (
                        <div className="text-center py-8 text-ink-muted">
                            No metrics found. Click "Add Metric" to enter manually.
                        </div>
                    ) : (
                        metrics.map((metric, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-surface-muted p-3 rounded-xl border border-border flex-wrap sm:flex-nowrap">
                                <div className="flex-1 min-w-[120px]">
                                    <input 
                                        type="text"
                                        placeholder="Metric Name"
                                        value={metric.originalName || metric.semanticMeaning || ""}
                                        onChange={(e) => {
                                            const newMetrics = [...metrics];
                                            newMetrics[idx] = { ...newMetrics[idx], originalName: e.target.value, semanticMeaning: e.target.value };
                                            setMetrics(newMetrics);
                                        }}
                                        className="text-sm font-bold text-ink bg-transparent outline-none w-full border-b border-transparent focus:border-primary-500 transition-colors"
                                    />
                                </div>
                                <div className="w-24">
                                    <input
                                        type="text"
                                        placeholder="Value"
                                        value={metric.rawValue || ""}
                                        onChange={(e) => handleValueChange(idx, e.target.value)}
                                        className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                                    />
                                </div>
                                <div className="w-16">
                                    <input
                                        type="text"
                                        placeholder="Unit"
                                        value={metric.unit || ""}
                                        onChange={(e) => {
                                            const newMetrics = [...metrics];
                                            newMetrics[idx] = { ...newMetrics[idx], unit: e.target.value };
                                            setMetrics(newMetrics);
                                        }}
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all text-center"
                                    />
                                </div>
                                <button
                                    onClick={() => handleDelete(idx)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                    <div className="pt-2">
                        <button
                            onClick={() => setMetrics([...metrics, { originalName: "", standardizedCategory: "custom_" + Date.now(), semanticMeaning: "", rawValue: "", numericValue: null, unit: "", confidence: 1 }])}
                            className="w-full py-3 bg-surface-muted border border-dashed border-border text-ink-muted font-medium rounded-xl hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                            + Add Metric
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-border bg-surface dark:bg-surface-muted rounded-b-3xl">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || metrics.length === 0}
                        className="w-full py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        Save Data
                    </button>
                </div>
            </div>
        </div>
    );
}
