"use client";

import { useState, useTransition } from "react";
import { banUser, unbanUser, deleteUser } from "./actions";
import { ShieldBan, ShieldCheck, Trash2, AlertCircle } from "lucide-react";

interface UserActionsProps {
  /** UUID of the target user. */
  userId: string;
  /** Whether the user currently has an active ban. */
  isBanned: boolean;
  /** Whether the user has the admin role — admins are protected from actions. */
  isAdmin: boolean;
}

/**
 * Client component rendering ban/unban and delete buttons for a user row.
 * Admins are protected and display a "Защищён" label instead.
 * All server action errors are caught and displayed inline.
 */
export default function UserActions({
  userId,
  isBanned,
  isAdmin,
}: UserActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
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
  );
}
