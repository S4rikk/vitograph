"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import FoodInputForm from "./FoodInputForm";
import { FeedbackButton } from "./FeedbackButton";
import DailyAllowancesPanel from "./DailyAllowancesPanel";
import DatePaginator from "./DatePaginator";
import WaterTracker from "./WaterTracker";
import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { getTzDayBoundaries, getTzToday } from "@/lib/date-utils";

type Message = {
  id: number;
  variant: "user" | "system";
  text: string;
  time: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: 0,
    variant: "system",
    text: "Привет! Я помогу вести дневник питания. Введите название блюда и его вес — я всё запомню 📋",
    time: "09:00",
  },
];

export default function FoodDiaryView() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1000); // Start high to avoid collision with mapped history IDs

  // Date State for Time Machine feature
  const [isMounted, setIsMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [userTimezone, setUserTimezone] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Load Profile & Timezone
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await apiClient.getProfile(user.id);
      const tz = profile?.timezone || "UTC";
      setUserTimezone(tz);
      // Initialize selectedDate with Tz-aware "Today"
      setSelectedDate(getTzToday(tz));
    }
    loadProfile();
  }, [supabase]);

  const [threadId] = useState("diary"); // Backend ignores this for DB but uses mode

  // Load user profile to get timezone
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const profile = await apiClient.getProfile(user.id);
        if (profile?.timezone) {
          setUserTimezone(profile.timezone);
        }
      } catch (err) {
        console.error("Failed to load user profile for timezone:", err);
      }
    }
    loadProfile();
  }, [supabase]);

  // Load chat history when date changes
  useEffect(() => {
    async function loadHistory() {
      if (!isMounted || !userTimezone) return;

      try {
        const { startIso, endIso } = getTzDayBoundaries(selectedDate, userTimezone);
        console.info('[Diary] Querying history boundaries:', { startIso, endIso });

        // Pass accurate boundaries to the backend
        const data = await apiClient.getChatHistory("diary", startIso, endIso);

        if (data.history && data.history.length > 0) {
          const mapped: Message[] = data.history.map((m: any, idx: number) => {
            const dateStr = m.createdAt ? new Date(m.createdAt) : new Date();
            return {
              id: idx + 1,
              variant: m.role === "assistant" ? "system" : "user",
              text: m.content,
              time: `${dateStr.getHours().toString().padStart(2, "0")}:${dateStr.getMinutes().toString().padStart(2, "0")}`,
            };
          });
          setMessages([...INITIAL_MESSAGES, ...mapped]);
        } else {
          // If no history for this date, just show the greeting
          setMessages([...INITIAL_MESSAGES]);
        }
      } catch (err) {
        console.error("Failed to load diary history:", err);
      }
    }
    loadHistory();
  }, [selectedDate, userTimezone]);

  const [consumed, setConsumed] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [consumedMicros, setConsumedMicros] = useState<Record<string, number>>({});
  const [dynamicTarget, setDynamicTarget] = useState({ calories: 2000, protein: 120, fat: 60, carbs: 250 });
  const [dynamicMicros, setDynamicMicros] = useState<Record<string, number>>({});
  const [rationale, setRationale] = useState<string>("Базовая норма");

  // Fetch macros based on the selected date
  const fetchMacrosForDate = useCallback(async (date: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the new single source of truth for deterministic norms
      try {
        const aiTargets = await apiClient.getNutritionTargets();
        if (aiTargets?.macros) setDynamicTarget(aiTargets.macros);
        if (aiTargets?.micros) setDynamicMicros(aiTargets.micros);
        if (aiTargets?.rationale) setRationale(aiTargets.rationale);
      } catch (err) {
        console.error("Failed to load nutrition targets:", err);
      }

      if (!userTimezone) return;

      const { startIso, endIso } = getTzDayBoundaries(date, userTimezone);
      console.info('[Diary] Querying macro boundaries:', { startIso, endIso });

      const { data: mealLogs } = await supabase
        .from('meal_logs')
        .select('id, total_calories, total_protein, total_fat, total_carbs, micronutrients')
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lte('logged_at', endIso);

      if (mealLogs) {
        let calories = 0, protein = 0, fat = 0, carbs = 0;
        const microsMap: Record<string, number> = {};

        mealLogs.forEach((log: any) => {
          calories += Number(log.total_calories || 0);
          protein += Number(log.total_protein || 0);
          fat += Number(log.total_fat || 0);
          carbs += Number(log.total_carbs || 0);

          // Aggregate micronutrients
          if (log.micronutrients && typeof log.micronutrients === 'object') {
            for (const [key, val] of Object.entries(log.micronutrients)) {
              if (typeof val === 'number') {
                microsMap[key] = (microsMap[key] || 0) + val;
              }
            }
          }
        });

        // Round all micros to 2 decimal places max
        for (const key in microsMap) {
          microsMap[key] = Number(microsMap[key].toFixed(2));
        }

        setConsumed({ calories, protein, fat, carbs });
        setConsumedMicros(microsMap);
      } else {
        setConsumed({ calories: 0, protein: 0, fat: 0, carbs: 0 });
        setConsumedMicros({});
      }
    } catch (e) {
      console.error("Failed to fetch macros", e);
    }
  }, [supabase, userTimezone]);

  useEffect(() => {
    if (!isMounted || !userTimezone) return;
    fetchMacrosForDate(selectedDate);
  }, [selectedDate, userTimezone, isMounted]);

  // Re-fetch norms when profile is saved from UserProfileSheet
  useEffect(() => {
    const handler = () => {
      fetchMacrosForDate(selectedDate);
      // Also refresh timezone
      async function refreshTz() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await apiClient.getProfile(user.id);
          if (profile?.timezone) setUserTimezone(profile.timezone);
        }
      }
      refreshTz();
    };
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [fetchMacrosForDate, selectedDate, supabase]);

  /* Auto scroll to bottom when new messages arrive */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback((name: string, weight: number, nutritionalContext?: any) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const textPayload = `${name} — ${weight}г`;

    const userMsg: Message = {
      id: nextId.current++,
      variant: "user",
      text: textPayload,
      time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    // Call AI API via LangGraph integration
    apiClient
      .chat(textPayload, threadId, undefined, "diary", undefined, nutritionalContext)
      .then((payload) => {
        const aiMsg: Message = {
          id: nextId.current++,
          variant: "system",
          text: payload.response,
          time,
        };
        setMessages((prev) => [...prev, aiMsg]);
        fetchMacrosForDate(selectedDate); // Re-fetch to update progress bars
      })
      .catch((err) => {
        const errorMsg: Message = {
          id: nextId.current++,
          variant: "system",
          text: `⚠️ Ошибка связи с AI: ${(err as Error).message}`,
          time,
        };
        setMessages((prev) => [...prev, errorMsg]);
      })
      .finally(() => {
        setIsThinking(false);
      });
  }, [threadId, fetchMacrosForDate, selectedDate]);

  if (!isMounted || !userTimezone) {
    return null; // Prevent hydration mismatch and race conditions
  }

  return (
    <>
      <FeedbackButton className="z-30" />
      <div className="flex flex-col h-[100dvh] sm:h-[85vh] sm:max-h-[1000px] sm:min-h-[750px] sm:rounded-2xl border-x sm:border border-border bg-white overflow-hidden shadow-sm">
        {/* ── Header & Time Machine ──────────────────────── */}
        <div className="flex flex-col bg-surface-muted px-5 pt-5 pb-2 shrink-0 z-10 border-b border-border/50">
          <DatePaginator selectedDate={selectedDate} onChange={setSelectedDate} userTimezone={userTimezone} />
        </div>

        {/* ── Scrollable Content (Panels + Chat) ──────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-surface-subtle flex flex-col"
        >
          <div className="shrink-0 bg-white flex flex-col pt-1">
            <DailyAllowancesPanel consumed={consumed} consumedMicros={consumedMicros} dynamicTarget={dynamicTarget} dynamicMicros={dynamicMicros} rationale={rationale} />
            <WaterTracker selectedDate={selectedDate} userTimezone={userTimezone} />
          </div>

          {/* ── Messages ──────────────────────────────────────── */}
          <div className="px-4 py-4 space-y-3 flex-1">
            {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              variant={msg.variant}
              text={msg.text}
              time={msg.time}
            />
          ))}
          {isThinking && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-surface-muted text-ink-muted rounded-2xl rounded-tl-none px-4 py-2 text-sm">
                Думаю... 🧠
              </div>
            </div>
          )}
        </div>
        </div>

        {/* ── Input ─────────────────────────────────────────── */}
        <div className="sticky bottom-0 z-20 border-t border-border p-3 bg-white/80 backdrop-blur-md pb-[safe-area-inset-bottom]">
          <FoodInputForm onSubmit={handleSubmit} />
        </div>
      </div>
    </>
  );
}
