"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type WaterTrackerProps = {
  selectedDate: Date;
};

export default function WaterTracker({ selectedDate }: WaterTrackerProps) {
  const [glasses, setGlasses] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const targetGlasses = 8;
  const supabase = createClient();

  const loadWater = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = selectedDate.toISOString().split("T")[0];
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("water_logs")
        .select("id, amount_glasses")
        .eq("user_id", user.id)
        .gte("logged_at", startOfDay.toISOString())
        .lte("logged_at", endOfDay.toISOString())
        .order("logged_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setGlasses(data[0].amount_glasses);
        setLogId(data[0].id);
      } else {
        setGlasses(0);
        setLogId(null);
      }
    } catch (err) {
      console.error("Failed to load water:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, supabase]);

  useEffect(() => {
    loadWater();
  }, [loadWater]);

  const updateWater = async (newAmount: number) => {
    if (newAmount < 0) return;
    setGlasses(newAmount); // Optimistic UI

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (logId) {
        await supabase
          .from("water_logs")
          .update({ amount_glasses: newAmount })
          .eq("id", logId);
      } else {
        // Use noon of the selected date so it doesn't accidentally shift timezones
        const logTime = new Date(selectedDate);
        logTime.setHours(12, 0, 0, 0);

        const { data, error } = await supabase
          .from("water_logs")
          .insert({
            user_id: user.id,
            amount_glasses: newAmount,
            logged_at: logTime.toISOString(),
          })
          .select("id")
          .single();

        if (error) throw error;
        if (data) setLogId(data.id);
      }
    } catch (err) {
      console.error("Failed to update water:", err);
      loadWater(); // Revert on failure
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border-b border-border p-4 flex items-center justify-center h-16">
        <div className="animate-pulse w-32 h-4 bg-surface-muted rounded"></div>
      </div>
    );
  }

  const isFull = glasses >= targetGlasses;

  return (
    <div className="bg-white border-b border-border px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[1.1rem]">💧</span>
        <div>
          <span className="text-sm font-semibold text-ink">Вода </span>
          <span className={`text-[11px] ${isFull ? 'text-green-500 font-bold' : 'text-ink-muted'}`}>
            ({glasses} / {targetGlasses} стаканов)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => updateWater(glasses - 1)}
          disabled={glasses === 0}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-ink hover:bg-surface-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Visual Drops Indicator */}
        <div className="flex gap-0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-3.5 rounded-full transition-colors duration-300 ${i < glasses ? 'bg-primary-500' : 'bg-cloud-dark'}`}
            />
          ))}
        </div>

        <button
          onClick={() => updateWater(glasses + 1)}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-ink hover:bg-surface-muted transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
