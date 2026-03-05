"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { Bug, Send, Image as ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FeedbackButton() {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<"bug" | "suggestion">("bug");
    const [message, setMessage] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (selected.size > 5 * 1024 * 1024) {
                alert("Файл слишком большой. Максимальный размер 5MB.");
                return;
            }
            setFile(selected);
        }
    };

    const removeFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        try {
            setIsSubmitting(true);
            let publicUrl: string | undefined = undefined;

            if (file) {
                const supabase = createClient();
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { error } = await supabase.storage
                    .from("feedback-screens")
                    .upload(fileName, file);

                if (error) {
                    throw new Error("Не удалось загрузить изображение");
                }

                const { data: publicData } = supabase.storage
                    .from("feedback-screens")
                    .getPublicUrl(fileName);

                publicUrl = publicData.publicUrl;
            }

            await apiClient.sendFeedback(category, message, publicUrl);

            // Success
            setOpen(false);
            setMessage("");
            setFile(null);
            alert("Спасибо за обратную связь!");
        } catch (err: any) {
            if (err.message === "429") {
                alert("Вы отправляете отзывы слишком часто. Подождите немного.");
            } else {
                alert(err.message || "Произошла ошибка при отправке отзыва.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="fixed top-6 right-6 z-40 group">
                {/* Glowing pulse aura */}
                <div className="absolute inset-0 rounded-full bg-indigo-500/60 blur-md animate-pulse pointer-events-none"></div>

                <button
                    onClick={() => setOpen(true)}
                    className="relative flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-xl active:scale-95"
                >
                    <Bug className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    <span className="hidden sm:inline">Сообщить об ошибке</span>
                </button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    onClose={() => setOpen(false)}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="mb-4">
                        <DialogTitle>Обратная связь 🚀</DialogTitle>
                        <DialogDescription>
                            Нашли ошибку или есть идея как улучшить приложение? Напишите нам, мы все читаем!
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Category Toggle */}
                        <div className="flex rounded-lg bg-surface-muted p-1">
                            <button
                                type="button"
                                onClick={() => setCategory("bug")}
                                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${category === "bug" ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
                            >
                                Баг (Ошибка)
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory("suggestion")}
                                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${category === "suggestion" ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
                            >
                                Предложение
                            </button>
                        </div>

                        {/* Message Area */}
                        <div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Подробно опишите, что случилось..."
                                maxLength={2000}
                                required
                                className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-surface-muted p-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />

                            {/* File Upload & Preview Section */}
                            <div className="flex items-start justify-between mt-2">
                                <div>
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        Прикрепить скриншот
                                    </button>
                                </div>
                                <div className="text-right text-xs text-ink-muted">
                                    {message.length} / 2000
                                </div>
                            </div>

                            {file && (
                                <div className="mt-3 relative inline-block">
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt="Preview"
                                        className="h-24 w-auto rounded-lg border border-border object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeFile}
                                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow border border-border text-ink-muted hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="mt-6">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={isSubmitting}
                                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50 sm:w-auto"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || message.trim().length === 0}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-surface-hover disabled:text-ink-faint sm:mt-0 sm:w-auto"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Отправка...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Отправить
                                    </>
                                )}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
