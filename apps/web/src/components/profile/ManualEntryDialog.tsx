"use client";

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import type { MetricFieldDefinition } from "@/types/wearable-types";

interface ManualEntryDialogProps {
    /** Whether the dialog is visible. */
    isOpen: boolean;
    /** Callback to close the dialog. */
    onClose: () => void;
    /** Title displayed in the dialog header. */
    title: string;
    /** Field definitions for the form inputs. */
    fields: MetricFieldDefinition[];
    /** Initial values keyed by field key. */
    initialValues?: Record<string, string>;
    /** Callback with the submitted values. */
    onSave: (values: Record<string, string>) => void;
}

/**
 * Modal dialog for manually entering wearable device metrics.
 *
 * Renders a dynamic form based on the `fields` prop — each field
 * gets a labeled input with the metric unit displayed inline.
 */
export default function ManualEntryDialog({
    isOpen,
    onClose,
    title,
    fields,
    initialValues = {},
    onSave,
}: ManualEntryDialogProps) {
    const [values, setValues] = useState<Record<string, string>>(() => {
        const defaults: Record<string, string> = {};
        for (const field of fields) {
            defaults[field.key] = initialValues[field.key] ?? "";
        }
        return defaults;
    });

    const handleChange = useCallback((key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(values);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                <div
                    className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-slide-up"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-divider">
                        <h3 className="text-lg font-bold text-ink-main">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-ink-muted hover:text-ink-main hover:bg-surface-muted rounded-full transition-colors cursor-pointer"
                            aria-label="Закрыть"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                        {fields.map((field) => (
                            <div key={field.key}>
                                <label
                                    htmlFor={`manual-${field.key}`}
                                    className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                >
                                    {field.label}
                                    {field.unit && (
                                        <span className="ml-1 text-ink-muted font-normal">
                                            ({field.unit})
                                        </span>
                                    )}
                                </label>
                                <input
                                    id={`manual-${field.key}`}
                                    type={field.type}
                                    step={field.step ?? (field.type === "number" ? "0.1" : undefined)}
                                    value={values[field.key] ?? ""}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    placeholder={field.placeholder ?? `Введите ${field.label.toLowerCase()}`}
                                    className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                />
                            </div>
                        ))}
                    </form>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-divider flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink-main rounded-lg hover:bg-surface-muted transition-colors cursor-pointer"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm active:scale-95 cursor-pointer"
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
