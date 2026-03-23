"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from "lucide-react";
import ChatMessage from "./ChatMessage";
import { detectAndParseFoodLog } from "./food-log-parser";
import { nutrientColors } from "@/lib/food-diary/nutrient-colors";
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
  
  // Weight Modal State
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
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
      
      // CRITICAL FIX: Fallback to the local browser TZ instead of "UTC" to prevent boundary shifting
      const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const tz = profile?.timezone || fallbackTz;
      
      setUserTimezone(tz);
      // Initialize selectedDate with Tz-aware "Today"
      setSelectedDate(getTzToday(tz));
    }
    loadProfile();
  }, [supabase]);

  const [threadId] = useState("diary"); // Backend ignores this for DB but uses mode



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

      const data = await apiClient.getDiaryDailyMacros(startIso, endIso);
      if (data && data.macros) {
        setConsumed(data.macros);
        setConsumedMicros(data.microsMap || {});
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

  // ── Meal Actions ──────────────────────────────────────────────────

  const handleDeleteMeal = useCallback(async (id: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот приём пищи?")) return;

    try {
      await apiClient.deleteMealLog(id);
      
      // Optimistic UI: remove the message containing this card
      setMessages(prev => prev.filter(m => {
          const parsed = detectAndParseFoodLog(m.text, m.time);
          return parsed?.cardProps.mealId !== id;
      }));

      // Refresh bars
      fetchMacrosForDate(selectedDate);
    } catch (err) {
      console.error("Failed to delete meal:", err);
      // alert("Не удалось удалить приём пищи");
    }
  }, [apiClient, fetchMacrosForDate, selectedDate]);

  const handleStartEdit = useCallback((id: string) => {
    // Find current weight from messages
    const msg = messages.find(m => {
        const parsed = detectAndParseFoodLog(m.text, m.time);
        return parsed?.cardProps.mealId === id;
    });
    
    if (msg) {
        const parsed = detectAndParseFoodLog(msg.text, msg.time);
        if (parsed) {
            setEditWeight(parsed.cardProps.weight);
            setEditingMealId(id);
        }
    }
  }, [messages]);

  const handleUpdateWeight = async () => {
    if (!editingMealId || isUpdating) return;
    setIsUpdating(true);
    try {
      // Find current weight to calculate ratio
      const msg = messages.find(m => {
          const parsed = detectAndParseFoodLog(m.text, m.time);
          return parsed?.cardProps.mealId === editingMealId;
      });
      
      let ratio = 1;
      if (msg) {
          const parsed = detectAndParseFoodLog(msg.text, msg.time);
          if (parsed && parsed.cardProps.weight > 0) {
              ratio = editWeight / parsed.cardProps.weight;
          }
      }

      await apiClient.updateMealLog(editingMealId, editWeight);
      
      // Optimistic UI update for BOTH card and text
      setMessages(prev => prev.map(m => {
          const parsed = detectAndParseFoodLog(m.text, m.time);
          if (parsed?.cardProps.mealId !== editingMealId) return m;

          let newText = m.text;
          // Same regex as backend
          newText = newText.replace(/(\d+)г/g, `${Math.round(editWeight)}г`);
          newText = newText.replace(/(\d+(?:[.,]\d+)?)\s*ккал/g, (_, val) => {
              const scaled = parseFloat(val.replace(',', '.')) * ratio;
              return `${Math.round(scaled)} ккал`;
          });
          newText = newText.replace(/(\d+(?:[.,]\d+)?)\s*г\s*(белков|жиров|углеводов)/g, (_, val, type) => {
              const scaled = parseFloat(val.replace(',', '.')) * ratio;
              return `${scaled.toFixed(1)}г ${type}`;
          });
          newText = newText.replace(/([А-ЯЁ][а-яё]+(?:\s+[а-яё]+)*):\s*(\d+(?:[.,]\d+)?)\s*(мг|мкг|г)/g, (_, name, val, unit) => {
             const scaled = parseFloat(val.replace(',', '.')) * ratio;
             return `${name}: ${scaled.toFixed(1)}${unit}`;
          });

          return { ...m, text: newText };
      }));
      
      fetchMacrosForDate(selectedDate);
      setEditingMealId(null);
    } catch (err) {
      console.error("Failed to update meal:", err);
      // alert("Не удалось обновить вес");
    } finally {
      setIsUpdating(false);
    }
  };

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
              onDelete={handleDeleteMeal}
              onEdit={handleStartEdit}
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

      {/* ── Weight Modal ── */}
      {editingMealId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-ink">Изменить вес</h3>
                  <div className="flex flex-col gap-1">
                      <label className="text-xs text-ink-muted uppercase font-bold tracking-wider">Новый вес (граммы)</label>
                      <input 
                          type="number" 
                          value={editWeight} 
                          onChange={(e) => setEditWeight(Number(e.target.value))}
                          className="w-full bg-surface-subtle border border-border rounded-xl px-4 py-3 text-lg font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateWeight()}
                      />
                  </div>
                  <div className="flex gap-2">
                      <button 
                          onClick={() => setEditingMealId(null)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-border text-ink font-semibold hover:bg-surface-muted transition-colors"
                      >
                          Отмена
                      </button>
                      <button 
                          onClick={handleUpdateWeight}
                          disabled={isUpdating}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                          {isUpdating ? "Сохраняю..." : "Сохранить"}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
}
