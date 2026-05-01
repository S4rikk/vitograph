"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Check, ShieldCheck } from "lucide-react";

type PasswordStrength = "weak" | "medium" | "strong";

const getPasswordStrength = (pwd: string): PasswordStrength => {
    if (pwd.length < 8) return "weak";
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (pwd.length >= 12 && score >= 3) return "strong";
    if (pwd.length >= 8 && score >= 2) return "medium";
    return "weak";
};

const STRENGTH_CONFIG: Record<PasswordStrength, { color: string; width: string }> = {
    weak: { color: "bg-red-400", width: "w-1/3" },
    medium: { color: "bg-amber-400", width: "w-2/3" },
    strong: { color: "bg-emerald-400", width: "w-full" },
};

export default function ChangePasswordForm() {
    const t = useTranslations("profile");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const strength = getPasswordStrength(newPassword);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!currentPassword) {
            setError(t("changePassword.errorCurrentRequired"));
            return;
        }
        if (newPassword.length < 8) {
            setError(t("changePassword.errorMinLength"));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t("changePassword.errorMismatch"));
            return;
        }

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (authError) {
                setError(authError.message);
                return;
            }

            setSuccess(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setSuccess(false), 4000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Success message */}
            {success && (
                <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2">
                    <Check size={16} className="shrink-0" />
                    <span>{t("changePassword.success")}</span>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    {error}
                </div>
            )}

            {/* Current Password */}
            <div className="flex flex-col">
                <label
                    htmlFor="current_password"
                    className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                >
                    {t("changePassword.currentPassword")}
                </label>
                <div className="relative">
                    <input
                        id="current_password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                        autoComplete="current-password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        tabIndex={-1}
                    >
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            {/* New Password */}
            <div className="flex flex-col">
                <label
                    htmlFor="new_password"
                    className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                >
                    {t("changePassword.newPassword")}
                </label>
                <div className="relative">
                    <input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                        autoComplete="new-password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        tabIndex={-1}
                    >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword.length > 0 && (
                    <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${STRENGTH_CONFIG[strength].color} ${STRENGTH_CONFIG[strength].width}`}
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-ink-muted" />
                            <span className="text-xs text-ink-muted">
                                {t(`changePassword.strength${strength.charAt(0).toUpperCase() + strength.slice(1)}`)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col">
                <label
                    htmlFor="confirm_password"
                    className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                >
                    {t("changePassword.confirmPassword")}
                </label>
                <input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                    autoComplete="new-password"
                />
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                className="px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
                {isSubmitting ? t("changePassword.submitting") : t("changePassword.submit")}
            </button>
        </form>
    );
}
