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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [threadId] = useState("diary"); // Backend ignores this for DB but uses mode

  // Load chat history when date changes
  useEffect(() => {
    async function loadHistory() {
      try {
        // Create an exact start and end of the local day to send to the server
        const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

        // Pass accurate boundaries to the backend
        const data = await apiClient.getChatHistory("diary", startOfDay.toISOString(), endOfDay.toISOString());

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
  }, [selectedDate]);

  const [consumed, setConsumed] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  const [consumedMicros, setConsumedMicros] = useState<Record<string, number>>({});
  const [dynamicTarget, setDynamicTarget] = useState({ calories: 2000, protein: 120, fat: 60, carbs: 250 });
  const [dynamicMicros, setDynamicMicros] = useState<Record<string, number>>({});
  const [rationale, setRationale] = useState<string>("Базовая норма");
  const supabase = createClient();

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

      // Create a local midnight start without parsing as UTC
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      const { data: mealLogs } = await supabase
        .from('meal_logs')
        .select('id, total_calories, micronutrients, items:meal_items(protein_g, fat_g, carbs_g)')
        .eq('user_id', user.id)
        .gte('logged_at', startOfDay.toISOString())
        .lte('logged_at', endOfDay.toISOString());

      if (mealLogs) {
        let calories = 0, protein = 0, fat = 0, carbs = 0;
        const microsMap: Record<string, number> = {};

        mealLogs.forEach((log: any) => {
          calories += Number(log.total_calories || 0);

          // Aggregate micronutrients
          if (log.micronutrients && typeof log.micronutrients === 'object') {
            for (const [key, val] of Object.entries(log.micronutrients)) {
              if (typeof val === 'number') {
                microsMap[key] = (microsMap[key] || 0) + val;
              }
            }
          }

          log.items?.forEach((item: any) => {
            protein += Number(item.protein_g || 0);
            fat += Number(item.fat_g || 0);
            carbs += Number(item.carbs_g || 0);
          });
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
  }, [supabase]);

  useEffect(() => {
    fetchMacrosForDate(selectedDate);
  }, [fetchMacrosForDate, selectedDate]);

  // Re-fetch norms when profile is saved from UserProfileSheet
  useEffect(() => {
    const handler = () => fetchMacrosForDate(selectedDate);
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [fetchMacrosForDate, selectedDate]);

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

  return (
    <>
      <FeedbackButton className="z-30" />
      <div className="flex flex-col h-[100dvh] sm:h-[750px] sm:rounded-2xl border-x sm:border border-border bg-white overflow-hidden shadow-sm">
        {/* ── Header & Time Machine ──────────────────────── */}
        <div className="flex flex-col bg-surface-muted px-5 pt-5 pb-2">
          <DatePaginator selectedDate={selectedDate} onChange={setSelectedDate} />
        </div>

        <DailyAllowancesPanel consumed={consumed} consumedMicros={consumedMicros} dynamicTarget={dynamicTarget} dynamicMicros={dynamicMicros} rationale={rationale} />
        <WaterTracker selectedDate={selectedDate} />

        {/* ── Messages ──────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-subtle"
        >
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

        {/* ── Input ─────────────────────────────────────────── */}
        <div className="sticky bottom-0 z-20 border-t border-border p-3 bg-white/80 backdrop-blur-md pb-[safe-area-inset-bottom]">
          <FoodInputForm onSubmit={handleSubmit} />
        </div>
      </div>
    </>
  );
}
