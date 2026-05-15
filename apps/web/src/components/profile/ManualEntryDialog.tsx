"use client";

import { useState, useCallback } from "react";
import type { MetricFieldDefinition } from "@/types/wearable-types";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

    const t = useTranslations("common");

    const handleChange = useCallback((key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(values);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent onClose={onClose} className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                {/* Form */}
                <form onSubmit={handleSubmit} className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {fields.map((field) => (
                        <div key={field.key}>
                            <label
                                htmlFor={`manual-${field.key}`}
                                className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
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
                                placeholder={field.placeholder ?? `${t("enterValue")} ${field.label.toLowerCase()}`}
                                className="w-full px-3 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-muted text-sm text-ink transition-all focus:bg-surface"
                            />
                        </div>
                    ))}
                </form>

                {/* Footer */}
                <DialogFooter className="mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink rounded-xl hover:bg-surface-muted transition-colors cursor-pointer"
                    >
                        {t("cancel")}
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        {t("save")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
