"use client";

import { useState } from "react";

interface DailySignup {
  date: string;
  count: number;
}

interface UserGrowthChartProps {
  data: DailySignup[];
}

/**
 * Pure CSS bar chart for daily user signups.
 * No external chart libraries — renders bars via flexbox + percentage heights.
 */
export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const formatDateShort = (isoDate: string): string => {
    const [, month, day] = isoDate.split("-");
    return `${day}.${month}`;
  };

  const formatDateFull = (isoDate: string): string => {
    const [year, month, day] = isoDate.split("-");
    return `${day}.${month}.${year}`;
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in-up">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">
          Ежедневные регистрации
        </h3>
        <p className="text-sm text-slate-400 mt-1">Последние 30 дней</p>
      </div>

      {/* Chart area */}
      <div className="relative">
        {/* Bars container */}
        <div className="flex items-end gap-[3px] h-56">
          {data.map((entry, idx) => {
            const heightPercent = (entry.count / maxCount) * 100;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={entry.date}
                className="relative flex-1 flex flex-col items-center justify-end h-full"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10 pointer-events-none border border-white/10">
                    <span className="font-medium">
                      {formatDateFull(entry.date)}
                    </span>
                    <span className="text-slate-400 ml-1.5">
                      {entry.count}{" "}
                      {entry.count === 1 ? "регистрация" : "регистраций"}
                    </span>
                  </div>
                )}

                {/* Bar */}
                <div
                  className={`w-full rounded-t-sm transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? "bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.3)]"
                      : "bg-blue-500"
                  }`}
                  style={{
                    height: `${Math.max(heightPercent, 1.5)}%`,
                    minHeight: "2px",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex items-center gap-[3px] mt-3">
          {data.map((entry, idx) => {
            // Show label every 5 days, plus always first and last
            const showLabel =
              idx === 0 || idx === data.length - 1 || idx % 5 === 0;
            return (
              <div
                key={`label-${entry.date}`}
                className="flex-1 text-center"
              >
                {showLabel && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatDateShort(entry.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
