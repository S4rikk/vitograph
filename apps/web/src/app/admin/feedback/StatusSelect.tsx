"use client";

import { useState, useTransition } from "react";
import { updateFeedbackStatus } from "./actions";

interface StatusSelectProps {
  /** Primary key of the feedback record. */
  id: number;
  /** Current status value for initial select state. */
  currentStatus: string;
}

/**
 * Client component that renders a `<select>` for changing feedback status.
 * Uses a server action with `useTransition` for optimistic UX.
 */
export default function StatusSelect({ id, currentStatus }: StatusSelectProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (newStatus: string) => {
    setStatus(newStatus);
    startTransition(async () => {
      await updateFeedbackStatus(id, newStatus);
    });
  };

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className="bg-slate-800 border border-white/10 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 cursor-pointer transition-opacity"
    >
      <option value="new">🆕 Новый</option>
      <option value="reviewed">👀 Просмотрен</option>
      <option value="resolved">✅ Решён</option>
    </select>
  );
}
