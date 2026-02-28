"use client";

import { useMemo } from "react";

type DatePaginatorProps = {
  selectedDate: Date;
  onChange: (d: Date) => void;
};

export default function DatePaginator({ selectedDate, onChange }: DatePaginatorProps) {
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const label = useMemo(() => {
    if (isToday) return "Сегодня";
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      selectedDate.getDate() === yesterday.getDate() &&
      selectedDate.getMonth() === yesterday.getMonth() &&
      selectedDate.getFullYear() === yesterday.getFullYear()
    ) {
      return "Вчера";
    }

    return selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }, [selectedDate, isToday]);

  const handlePrev = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    onChange(prev);
  };

  const handleNext = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    onChange(next);
  };

  const handleToday = () => {
    if (!isToday) {
      onChange(new Date());
    }
  };

  return (
    <div className="flex items-center justify-between bg-surface-muted rounded-xl p-1 mb-4 border border-border">
      <button 
        onClick={handlePrev}
        className="p-2 hover:bg-white rounded-lg transition-colors text-ink-muted hover:text-ink"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 text-center flex flex-col items-center justify-center cursor-pointer" onClick={handleToday}>
        <span className="text-sm font-semibold text-ink">{label}</span>
        {!isToday && (
          <span className="text-[10px] text-primary-600 hover:text-primary-700 font-medium tracking-wide uppercase mt-0.5">
            Вернуться в сегодня
          </span>
        )}
      </div>

      <button 
        onClick={handleNext}
        disabled={isToday}
        className={`p-2 rounded-lg transition-colors ${isToday ? 'opacity-30 cursor-not-allowed text-ink-faint' : 'hover:bg-white text-ink-muted hover:text-ink'}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
