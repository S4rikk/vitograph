"use client";

import { useMemo } from "react";
import { getTzToday } from "@/lib/date-utils";
import { useTranslations } from "next-intl";

type DatePaginatorProps = {
  selectedDate: Date;
  onChange: (d: Date) => void;
  userTimezone: string;
};

export default function DatePaginator({ selectedDate, onChange, userTimezone }: DatePaginatorProps) {
  const t = useTranslations('diary');
  
  const isToday = useMemo(() => {
    const today = getTzToday(userTimezone);
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate, userTimezone]);

  const label = useMemo(() => {
    if (isToday) return t('today');
    
    const yesterday = getTzToday(userTimezone);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      selectedDate.getDate() === yesterday.getDate() &&
      selectedDate.getMonth() === yesterday.getMonth() &&
      selectedDate.getFullYear() === yesterday.getFullYear()
    ) {
      // If yesterday exists in ru.json use it, else fallback to native string format
      return t('yesterday') !== 'yesterday' ? t('yesterday') : "Вчера";
    }

    return selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }, [selectedDate, isToday, userTimezone]);

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
    <div className="flex items-center justify-between bg-surface rounded-2xl p-1 mb-0 shadow-sm">
      <button 
        onClick={handlePrev}
        className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors text-ink-muted"
      >
        <span className="text-xs">◀</span>
      </button>

      <div className="flex-1 text-center flex flex-col items-center justify-center cursor-pointer" onClick={handleToday}>
        <span className="text-[0.9375rem] font-bold text-ink">{label}</span>
        {!isToday && (
          <span className="text-[0.625rem] text-primary-600 hover:text-primary-700 font-medium tracking-wide uppercase mt-0.5">
            {t('returnToToday') !== 'returnToToday' ? t('returnToToday') : "Вернуться в сегодня"}
          </span>
        )}
      </div>

      <button 
        onClick={handleNext}
        disabled={isToday}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isToday ? 'opacity-30 cursor-not-allowed bg-surface-muted text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-ink-muted'}`}
      >
        <span className="text-xs">▶</span>
      </button>
    </div>
  );
}
