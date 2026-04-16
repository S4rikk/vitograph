"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { banUser, unbanUser, deleteUser, updateUserEmail } from "./actions";
import { ShieldBan, ShieldCheck, Trash2, AlertCircle, Mail, X, Loader2, Check } from "lucide-react";

interface UserActionsProps {
  /** UUID of the target user. */
  userId: string;
  /** Current email of the user. */
  currentEmail: string;
  /** Whether the user currently has an active ban. */
  isBanned: boolean;
  /** Whether the user has the admin role — admins are protected from actions. */
  isAdmin: boolean;
}

/**
 * Client component rendering ban/unban, delete and email-change buttons.
 * Admins are protected and display a "Защищён" label instead.
 */
export default function UserActions({
  userId,
  currentEmail,
  isBanned,
  isAdmin,
}: UserActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Email edit modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [emailPending, startEmailTransition] = useTransition();
  const [emailError, setEmailError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isAdmin) {
    return <span className="text-xs text-slate-500 italic">Защищён</span>;
  }

  const handleBanToggle = () => {
    const msg = isBanned
      ? "Разблокировать пользователя?"
      : "Заблокировать пользователя?";
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      try {
        if (isBanned) await unbanUser(userId);
        else await banUser(userId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Неизвестная ошибка";
        setError(message);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("⚠️ УДАЛИТЬ пользователя? Это действие НЕОБРАТИМО!")) return;
    if (!confirm("Вы ТОЧНО уверены? Все данные пользователя будут потеряны."))
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser(userId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Неизвестная ошибка";
        setError(message);
      }
    });
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!newEmail || newEmail === currentEmail) {
      setEmailModalOpen(false);
      return;
    }
    startEmailTransition(async () => {
      try {
        await updateUserEmail(userId, newEmail);
        setEmailModalOpen(false);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Ошибка смены почты";
        setEmailError(message);
      }
    });
  };

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          {/* Change email */}
          <button
            onClick={() => {
              setNewEmail(currentEmail);
              setEmailError(null);
              setEmailModalOpen(true);
            }}
            disabled={isPending}
            title="Изменить email"
            className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
          </button>

          {/* Ban / Unban */}
          <button
            onClick={handleBanToggle}
            disabled={isPending}
            title={isBanned ? "Разблокировать" : "Заблокировать"}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
              isBanned
                ? "text-green-400 hover:bg-green-500/10"
                : "text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            {isBanned ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldBan className="w-4 h-4" />
            )}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isPending}
            title="Удалить навсегда"
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <span
            className="flex items-center gap-1 text-red-400 text-[10px] max-w-[160px] text-right"
            title={error}
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{error}</span>
          </span>
        )}
      </div>

      {/* Email change modal — via portal to escape overflow-y-auto */}
      {mounted && emailModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => !emailPending && setEmailModalOpen(false)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-medium text-white">Изменить email</h2>
              <button
                onClick={() => setEmailModalOpen(false)}
                disabled={emailPending}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">Текущий: <span className="text-slate-300">{currentEmail}</span></p>

              {emailError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{emailError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Новый Email
                </label>
                <input
                  type="email"
                  required
                  disabled={emailPending}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                  placeholder="new@example.com"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  disabled={emailPending}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={emailPending}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {emailPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
