import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getTzDayBoundaries } from "@/lib/date-utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type WaterTrackerProps = {
  selectedDate: Date;
  userTimezone?: string;
};

export default function WaterTracker({ selectedDate, userTimezone }: WaterTrackerProps) {
  const [glasses, setGlasses] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const targetGlasses = 8;
  const [supabase] = useState(() => createClient());
  const { isSupported, isSubscribed, isPushLoading, subscribe, unsubscribe } = usePushNotifications();

  const loadWater = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { startIso, endIso } = getTzDayBoundaries(selectedDate, userTimezone || 'UTC');

      const { data, error } = await supabase
        .from("water_logs")
        .select("id, amount_glasses")
        .eq("user_id", user.id)
        .gte("logged_at", startIso)
        .lte("logged_at", endIso)
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
  }, [selectedDate, supabase, userTimezone]);

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
        const { data, error } = await supabase
          .from("water_logs")
          .insert({
            user_id: user.id,
            amount_glasses: newAmount,
            logged_at: new Date().toISOString(),
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
      <div className="w-full bg-transparent px-4 py-1 flex items-center justify-center">
        <div className="animate-pulse w-32 h-4 bg-surface-muted rounded"></div>
      </div>
    );
  }

  const isFull = glasses >= targetGlasses;

  return (
    <div className="bg-transparent px-4 py-1 flex items-center justify-end gap-4 w-full">
      <div className="flex items-center gap-1">
        <span className="text-[1.1rem]">💧</span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div>
            <span className="text-sm font-semibold text-ink">Вода </span>
            <span className={`text-[0.6875rem] ${isFull ? 'text-green-500 font-bold' : 'text-ink-muted'}`}>
              ({glasses} / {targetGlasses} стаканов)
            </span>
          </div>

          <button 
              onClick={async () => {
                if (isPushLoading) return;
                if (!isSupported) {
                  window.alert('🔕 Push-уведомления недоступны в этом браузере. Откройте сайт в Chrome или Safari для включения напоминаний.');
                  return;
                }
                if (isSubscribed) {
                  await unsubscribe();
                } else {
                  await subscribe();
                }
              }}
              disabled={isPushLoading}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                isPushLoading ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                isSubscribed && !isPushLoading
                  ? 'text-primary-500 hover:text-primary-600 bg-primary-50/50' 
                  : !isPushLoading 
                    ? 'text-ink-muted hover:text-ink hover:bg-surface-muted' 
                    : 'text-ink-muted bg-surface-muted'
              }`}
              title={isSubscribed ? "Отключить напоминания" : "Включить напоминания"}
            >
              {isPushLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isSubscribed ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
            </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => {
            if (window.confirm("Убрать один выпитый стакан воды?")) {
              updateWater(glasses - 1);
            }
          }}
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
