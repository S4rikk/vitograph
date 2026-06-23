"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { nutrientColors, getMicronutrientColor } from "@/lib/food-diary/nutrient-colors";
import { compressImage } from "@/lib/image-utils";
import Image from "next/image";
import React from "react";
import HealthGoalsWidget from "@/components/shared/HealthGoalsWidget";
import { useTypewriter } from "@/hooks/use-typewriter";
import { useTranslations } from "next-intl";
import { BrainCircuit } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── CUSTOM PREMIUM RENDERERS ──

const ScoreBadge = ({ score, reason }: { score: number; reason: string }) => {
  const t = useTranslations("assistant.chat");
  let colorClass = "bg-red-50 text-red-700 border-red-200";
  let dotColor = "bg-red-500";
  let label = t("healthScorePoor"); // Poor
  
  if (score >= 86) {
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotColor = "bg-emerald-500";
    label = t("healthScoreIdeal"); // Ideal
  } else if (score >= 70) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    dotColor = "bg-amber-500";
    label = t("healthScoreGood"); // Good
  } else if (score >= 40) {
    colorClass = "bg-orange-50 text-orange-700 border-orange-200";
    dotColor = "bg-orange-500";
    label = t("healthScoreAverage"); // Average
  }

  return (
    <div className={`my-6 p-5 rounded-2xl border ${colorClass} shadow-sm overflow-hidden relative`}>
      <div className="flex items-center space-x-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface font-bold text-xl shadow-sm border border-inherit`}>
          {score}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`}></span>
            <p className="font-bold uppercase tracking-wider text-[0.6875rem] opacity-80">{label} Health Score</p>
          </div>
          <p className="text-sm italic mt-1 leading-snug font-medium text-ink-muted">{reason}</p>
        </div>
      </div>
      {/* Subtle background decoration */}
      <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    </div>
  );
};

const NutrPill = ({ type, children }: { type: string; children: React.ReactNode }) => {
  const content = String(children);
  const colorSpace = getMicronutrientColor(content);
  
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[0.8125rem] font-semibold border bg-surface-muted border-border mx-0.5 my-0 transition-all hover:scale-105 cursor-default shadow-sm ${colorSpace.text}`}>
       {children}
    </span>
  );
};

const AssistantMessageContent = ({ content }: { content: string }) => {
  // 1. Filter out <think> blocks
  let processed = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  // 2. Remove backslashes before formatting characters
  processed = processed.replace(/\\([<>\*\_!#\(\)\[\]\-\.\+])/g, "$1");

  // 3. Strip the technical "Записал..." line if present (it's for the Diary, not the Assistant)
  processed = processed.replace(/Записал\s+[\d.,]+\s*[гg]\s+[^:]+:\s*[\d.,]+\s*ккал[^\n]*/gi, '');

  // Strip <meal_score> tags entirely (Diary-only feature)
  processed = processed.replace(/<meal_score\s+[\s\S]*?\/>/gi, '');

  // Strip micro-nutrient tags (Diary-only data for FoodCard)
  processed = processed.replace(/<nut[a-z]*\s+[^>]*type[a-z]*=["']micro["'][^>]*>[\s\S]*?<\/nut[a-z]*>/gi, '');

  // Strip image placeholders [Image of ...]
  processed = processed.replace(/\[(?:Image|Graphic|Photo|Illustration)\s+of\s+[^\]]+\]/gi, '');

  // 5. Normalize Newlines: Single \n -> Space, Double \n -> \n\n (Paragraphs)
  processed = processed.replace(/\n+/g, (match) => match.length > 1 ? "\n\n" : " ");
  processed = processed.replace(/ {2,}/g, " ").trim();

  // Strip markdown artifacts that AI sometimes generates
  processed = processed
    .replace(/^#{1,4}\s+/gm, '')           // Remove ### headers
    .replace(/^\d+\.\s+/gm, '')            // Remove numbered list markers
    .replace(/^[-*]\s+/gm, '• ')           // Convert bullets to unicode
    .replace(/\*\*\s*\*\*/g, '');           // Remove empty **  **

  // Hide technical messages
  if (processed.includes("SUCCESS") && processed.length < 50) return null;

  const fragments: React.ReactNode[] = [];
  const nutrRegex = /<nut[a-z]*\s+[^>]*?type[a-z]*=['"]*([^'"]+?)['"]*[^>]*?>([\s\S]*?)<\/nut[a-z]*>/gi;

  const allMatches: { index: number; length: number; component: React.ReactNode }[] = [];
  let match;

  nutrRegex.lastIndex = 0;
  while ((match = nutrRegex.exec(processed)) !== null) {
    allMatches.push({ index: match.index, length: match[0].length, component: <NutrPill key={`nutr-${match.index}`} type={match[1]}>{match[2]}</NutrPill> });
  }

  allMatches.sort((a, b) => a.index - b.index);

  let currentPos = 0;
  allMatches.forEach((m) => {
    if (m.index > currentPos) {
      fragments.push(<span key={`text-${currentPos}`}>{parseInline(processed.substring(currentPos, m.index))}</span>);
    }
    fragments.push(m.component);
    currentPos = m.index + m.length;
  });

  if (currentPos < processed.length) {
    fragments.push(<span key={`text-${currentPos}`}>{parseInline(processed.substring(currentPos))}</span>);
  }

  // Render in a container with pre-wrap to respect the preserved double-newlines as paragraph breaks
  return (
    <div className="assistant-content flex flex-col gap-3">
      <div className="whitespace-pre-wrap leading-relaxed text-[0.9375rem] text-ink-muted/90">
        {fragments}
      </div>
    </div>
  );
};

// 1. Создаем выделенный компонент только для АКТИВНОЙ печати
const ActiveTypewriterNode = ({ content, speed }: { content: string; speed: number }) => {
  const displayedText = useTypewriter(content, speed);
  const targetScrollRef = useRef<number>(0);
  
  // Обновляем целевую позицию при появлении каждого нового символа
  useEffect(() => {
    const container = document.getElementById("ai-chat-scroll-container");
    if (container) {
      targetScrollRef.current = container.scrollHeight - container.clientHeight;
    }
  }, [displayedText]);

  // Независимый 60 FPS цикл для идеальной плавности (Lerp) без сбросов
  useEffect(() => {
    let rAF: number;
    const container = document.getElementById("ai-chat-scroll-container");
    
    const smoothLoop = () => {
      if (!container) return;
      const target = targetScrollRef.current;
      const current = container.scrollTop;
      const distanceFromBottom = container.scrollHeight - current - container.clientHeight;
      
      // Если пользователь скроллил наверх (>5px от дна), НЕ давим вниз
      if (distanceFromBottom > 5) {
        rAF = requestAnimationFrame(smoothLoop);
        return;
      }
      
      // Если есть разница между текущим и целевым скроллом, плавно догоняем (easing 15%)
      if (target > 0 && target - current > 0.5) {
        container.scrollTop = current + (target - current) * 0.15;
      }
      rAF = requestAnimationFrame(smoothLoop);
    };
    
    smoothLoop();
    return () => {
      if (rAF) cancelAnimationFrame(rAF);
    };
  }, []);

  return <AssistantMessageContent content={displayedText} />;
};

// 2. Умная обертка для разделения потоков (История vs Новый текст)
const TypewritingAssistantMessage = ({ content, isTyping }: { content: string; isTyping: boolean }) => {
  // Если это старое сообщение из базы данных, мы ВООБЩЕ избегаем стейт-хуков.
  // Это гарантирует 0 миллисекунд задержки и никаких мерцаний при загрузке страницы.
  if (!isTyping) {
    return <AssistantMessageContent content={content} />;
  }

  // Задержка 13мс (примерно 77 символов в секунду ~ 750 слов в минуту) дает мгновенное визуальное проявление
  return <ActiveTypewriterNode content={content} speed={13} />;
};

const parseInline = (text: string) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-ink-dark">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
};

export default function AiAssistantView({ userId }: { userId: string }) {
  const t = useTranslations("assistant.chat");
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [zoomedImageId, setZoomedImageId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  // --- INSIGHT WIDGET STATE ---
  const [supabase] = useState(() => createClient());
  const [isInsightReady, setIsInsightReady] = useState(false);
  const [isInsightDismissed, setIsInsightDismissed] = useState(false);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [showInsightPopover, setShowInsightPopover] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("insight_dismissed");
    if (dismissed === "true") {
      setIsInsightDismissed(true);
    }
    
    const todayDate = new Date().toISOString().split("T")[0];
    const lastDate = localStorage.getItem("vitograph_last_insight_date");
    if (lastDate === todayDate) {
      setIsOnCooldown(true);
    }
    
    async function checkInsightReadiness() {
      if (!userId) return;
      try {
        const { count } = await supabase
          .from('daily_symptoms')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
          
        if (count && count >= 3) {
          setIsInsightReady(true);
        }
      } catch (err) {
        console.error("Failed to check insight readiness", err);
      }
    }
    checkInsightReadiness();
  }, [supabase, userId]);

  const dismissInsight = () => {
    setIsInsightDismissed(true);
    sessionStorage.setItem("insight_dismissed", "true");
  };
  // ----------------------------

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("welcomeMessage"),
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUpRef = useRef(false);
  
  const [threadId, setThreadId] = useState<string>("");

  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImage(file, 1024);
      setSelectedImageBase64(base64);
    } catch (err) {
      console.error("Failed to compress image:", err);
      alert(t("uploadPhotoFailed"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 1. Hydrate state from Database on client mount
  useEffect(() => {
    setIsMounted(true);
    
    async function loadHistory() {
      try {
        const data = await apiClient.getChatHistory("assistant");
        if (data.history && data.history.length > 0) {
          setMessages(data.history);
        }
      } catch (e) {
        console.error("Failed to load global AI messages", e);
      } finally {
        setIsHistoryLoaded(true);
      }
    }

    loadHistory();
    setThreadId("assistant"); // Backend uses deterministic ID based on user ID and mode
  }, []);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiClient.getProfile(userId);
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile for assistant name", err);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handleUpdate = () => {
      loadProfile();
    };
    window.addEventListener("profile-updated", handleUpdate);
    return () => window.removeEventListener("profile-updated", handleUpdate);
  }, [loadProfile]);

  // Update welcome message when profile name is available
  useEffect(() => {
    if (profile?.ai_name && messages.length > 0 && messages[0].id === "welcome") {
      const currentContent = messages[0].content;
      const expectedContent = t("welcomeMessageWithName", { name: profile.ai_name });
      
      if (currentContent !== expectedContent) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[0] = { ...newMessages[0], content: expectedContent };
          return newMessages;
        });
      }
    }
  }, [profile?.ai_name, messages.length]);

  // 2. [DEPRECATED] Sync to Database whenever messages change
  // We no longer do this manually. The backend saves messages directly into ai_chat_messages
  // during the POST /chat request.

  // 3. Auto-scroll to bottom of chat when messages change or container resizes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Only auto-scroll if user hasn't scrolled up
    if (!userHasScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    // Also scroll when the container itself resizes (e.g. input expands)
    const resizeObserver = new ResizeObserver(() => {
      if (!userHasScrolledUpRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [messages]);

  // Detect when user manually scrolls up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // If user is more than 5px from bottom, they've scrolled up
      if (distanceFromBottom > 5) {
        userHasScrolledUpRef.current = true;
      } else {
        // User has scrolled back to bottom — resume auto-scroll
        userHasScrolledUpRef.current = false;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle the actual chat submission logic (separated so it can be called programmatically)
  const sendChatMessage = useCallback(async (content: string, thread: string, optionalImageUrl?: string, base64?: string) => {
    // Reset scroll-lock: when user sends a new message, they want to see the response
    userHasScrolledUpRef.current = false;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      imageUrl: optionalImageUrl || base64 || undefined,
    };

    // Create an empty placeholder for the assistant response BEFORE the API call
    const placeholderId = (Date.now() + 1).toString();
    const placeholderMsg: Message = { id: placeholderId, role: "assistant", content: "", isStreaming: true };
    setMessages((prev) => [...prev, userMsg, placeholderMsg]);
    setIsLoading(true);

    try {
      const res = await apiClient.chat(content, thread, undefined, "assistant", optionalImageUrl, undefined, base64,
        (token) => {
          setMessages(prev =>
            prev.map(m => m.id === placeholderId
              ? { ...m, content: m.content + token }
              : m
            )
          );
        }
      );

      // After stream completes, update the placeholder with the final full response
      // DO NOT set isStreaming to false! The typewriter must finish typing at its own pace.
      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { ...m, content: res.response }
          : m
        )
      );

      window.dispatchEvent(new Event("refresh-health-goals"));
    } catch (error) {
      console.error("[AiAssistant] Chat Error:", error);
      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { ...m, content: t("networkError") }
          : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 4. Auto-trigger based on query params (e.g., after photo upload)
  useEffect(() => {
    if (!isMounted || !threadId || !isHistoryLoaded) return;

    const trigger = searchParams.get("trigger");
    const uploadedImageUrl = searchParams.get("imageUrl");

    if (trigger === "nail_photo" && uploadedImageUrl) {
      const promptText = t("nailPhotoPrompt");
      
      // Delay the router replacement slightly to ensure React state has time to batch
      // and the component has fully hydrated its initial storage data.
      setTimeout(() => {
        router.replace("/?tab=ai", { scroll: false });
        sendChatMessage(promptText, threadId, uploadedImageUrl);
      }, 50);
    }
  }, [isMounted, threadId, searchParams, router, sendChatMessage, isHistoryLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImageBase64) || isLoading || !threadId) return;

    const content = input.trim() || t("assessProductPrompt");
    const base64 = selectedImageBase64 || undefined;
    
    setInput("");
    setSelectedImageBase64(null);
    await sendChatMessage(content, threadId, undefined, base64);
  };
  
  const handleClearChat = async () => {
    if (!threadId || isLoading) return;
    
    const confirmed = window.confirm(t("clearChatConfirm"));
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      await apiClient.deleteChatHistory("assistant");
      // Reset local state to initial welcome message
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t("welcomeMessage"),
        }
      ]);
    } catch (error) {
      console.error("[AiAssistant] Clear Error:", error);
      alert(t("clearChatError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full sm:h-[750px] sm:rounded-2xl sm:border border-white/70 dark:border-white/30 bg-surface/80 backdrop-blur-2xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Insight Gradient Def */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="insight-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {/* Premium Glass Edge Overlay */}
      <div className="pointer-events-none absolute inset-0 sm:rounded-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_1px_0_2px_rgba(255,255,255,0.5),inset_-1px_0_2px_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(255,255,255,0.2)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_1px_0_2px_rgba(255,255,255,0.15),inset_-1px_0_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05)] z-50"></div>
      
      {/* ── Header & Goals ──────────────────────── */}
      <div className="flex flex-col bg-surface-muted px-4 pt-3 sm:pt-5 pb-2 shrink-0 z-10 border-b border-border/50 relative">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0">
            <HealthGoalsWidget />
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Кнопка инсайтов */}
            <button
              onClick={() => {
                if (isInsightReady && !isInsightDismissed && !isOnCooldown) {
                  setShowInsightPopover(!showInsightPopover);
                }
              }}
              className={`p-2 transition-all duration-300 relative rounded-xl border shadow-sm h-10 w-10 flex items-center justify-center ${
                isInsightReady && !isInsightDismissed && !isOnCooldown
                  ? "text-purple-600 bg-purple-100 border-purple-200 hover:bg-purple-200 animate-pulse"
                  : "text-ink-muted bg-surface border-border hover:bg-surface-muted"
              }`}
              title="Инсайты"
            >
              <BrainCircuit className="h-5 w-5" />
              {isInsightReady && !isInsightDismissed && !isOnCooldown && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                </span>
              )}
            </button>

            {/* Popover для инсайтов */}
            {showInsightPopover && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowInsightPopover(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-72 p-4 bg-surface border border-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200 text-left">
                  {!isInsightReady ? (
                    <p className="text-sm text-ink-muted leading-relaxed">
                      Анализ пока недоступен. Мне нужно еще 3 дней данных о питании и симптомах, чтобы найти скрытые связи.
                    </p>
                  ) : isInsightDismissed ? (
                    <div className="flex flex-col space-y-3 relative z-10">
                      <p className="text-sm text-ink font-medium">
                        Инсайт готов. Запустить глубокий анализ?
                      </p>
                      <button 
                        onClick={() => { 
                          setShowInsightPopover(false); 
                          alert("Запуск глубокого анализа..."); 
                        }}
                        className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                      >
                        Запуск
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {/* Кнопка очистки чата */}
            <button
              onClick={handleClearChat}
              disabled={isLoading || messages.length <= 1}
              className="p-2 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-surface border border-border shadow-sm h-10 w-10 flex items-center justify-center"
              title={t("clearChatTitle")}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        id="ai-chat-scroll-container"
        className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-ink-muted/20 scrollbar-track-transparent"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-4 py-3 shadow-[0_4px_15px_rgba(0,0,0,0.3)] ${
                msg.role === "user"
                  ? "bg-primary-600 text-white rounded-br-none"
                  : "bg-cloud-light bg-[#1e293b]/70 text-white/95 rounded-bl-none"
              }`}
            >
                <div className="flex flex-col space-y-2">
                  {msg.imageUrl && (
                    <div 
                      className="relative w-32 h-32 rounded-lg overflow-hidden border border-cloud cursor-zoom-in group"
                      onClick={() => setZoomedImageId(msg.id)}
                    >
                      <Image 
                        src={msg.imageUrl} 
                        alt="Uploaded photo" 
                        fill 
                        className="object-cover transition-transform group-hover:scale-105"
                        unoptimized 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <TypewritingAssistantMessage content={msg.content} isTyping={!!msg.isStreaming} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[0.9375rem]">{msg.content}</p>
                  )}
                </div>
            </div>
          </div>
        ))}
        
        {/* THE BIG INSIGHT CARD */}
      {isInsightReady && !isInsightDismissed && !isOnCooldown && (
        <div className="mb-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gray-900/50 rounded-xl shrink-0">
                  <BrainCircuit size={24} style={{ stroke: "url(#insight-gradient)", strokeWidth: 2 }} />
                </div>
                <div className="flex-1">
                  <p className="text-[0.9375rem] leading-relaxed">
                    {profile?.first_name?.trim() ? `${profile.first_name.trim()}, у` : 'У'} нас накопилось достаточно записей о твоих симптомах. Я могу сопоставить их с дневником питания и найти скрытые причины. Запустить глубокий анализ?
                  </p>
                  <div className="mt-4 flex space-x-3">
                    <button 
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm shadow-sm"
                      onClick={() => {
                        dismissInsight();
                        const todayDate = new Date().toISOString().split("T")[0];
                        localStorage.setItem("vitograph_last_insight_date", todayDate);
                        setIsOnCooldown(true);
                        const prompt = "Пожалуйста, проанализируй мои симптомы и питание за последние дни и найди скрытые связи.";
                        sendChatMessage(prompt, threadId);
                      }}
                    >
                      Да, давай!
                    </button>
                    <button 
                      className="px-4 py-2 bg-gray-700 text-gray-200 font-medium rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      onClick={dismissInsight}
                    >
                      Позже
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {isLoading && messages.length > 0 && messages[messages.length - 1].content === "" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-cloud-light bg-[#1e293b]/70 text-white/95 px-4 py-3 shadow-[0_4px_15px_rgba(0,0,0,0.3)] rounded-bl-none">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-white/60 [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-white/60"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 p-3 sm:p-6 bg-cloud-light/30">
        {selectedImageBase64 && (
          <div className="relative inline-block mb-3 border border-cloud rounded-lg overflow-hidden shadow-sm">
            <img src={selectedImageBase64} alt="Selected" className="h-20 w-auto object-cover" />
            <button
              onClick={() => setSelectedImageBase64(null)}
              className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              title={t("removePhotoTitle")}
              type="button"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex space-x-3 items-end">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageSelect}
            className="hidden" 
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-xl bg-surface border border-cloud-dark px-3 py-3 text-ink-muted hover:text-primary-600 hover:border-primary-300 transition-colors focus:outline-none min-h-[44px]"
            title={t("attachPhotoTitle")}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={t("inputPlaceholder")}
            rows={1}
            style={{ fieldSizing: "content" } as any}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="flex-1 rounded-xl border-cloud-dark bg-surface px-4 py-3 text-[0.9375rem] text-ink shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 max-h-[150px] min-h-[44px] overflow-y-auto resize-none scrollbar-thin scrollbar-thumb-ink-muted/20 scrollbar-track-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !selectedImageBase64)}
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-3 sm:px-5 py-3 text-[0.9375rem] font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-cloud-dark disabled:text-ink-muted disabled:shadow-none min-h-[44px]"
          >
            <span className="hidden sm:inline">{t("send")}</span>
            <svg className="w-5 h-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Full-Screen Image Zoom Modal */}
      {zoomedImageId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImageId(null)}
        >
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center">
            {/* Find the selected message image array */}
            {messages.find(m => m.id === zoomedImageId)?.imageUrl && (
              <img 
                src={messages.find(m => m.id === zoomedImageId)!.imageUrl} 
                alt="Zoomed Photo" 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-zoom-out"
              />
            )}
            <button 
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImageId(null);
              }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
