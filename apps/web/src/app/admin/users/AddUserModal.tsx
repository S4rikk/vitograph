"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createUser } from "./actions";
import { UserPlus, X, Loader2, AlertCircle } from "lucide-react";

/**
 * Client component — modal dialog for creating a new user.
 * Follows the same design pattern as AddDocumentModal.
 */
export default function AddUserModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setEmail("");
    setPassword("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createUser(email, password);
        handleClose();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Ошибка создания пользователя";
        setError(message);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-200 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
      >
        <UserPlus className="w-4 h-4" />
        Добавить пользователя
      </button>

      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
              <h2 className="text-xl font-medium text-white">
                Новый пользователь
              </h2>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="add-user-email"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="add-user-email"
                  required
                  disabled={isPending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="add-user-password"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Пароль
                </label>
                <input
                  type="password"
                  id="add-user-password"
                  required
                  minLength={6}
                  disabled={isPending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
                  placeholder="Минимум 6 символов"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 bg-white hover:bg-slate-200 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Создать
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
