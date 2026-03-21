"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import Image from "next/image";
import React from "react";
import FoodCard from "../diary/FoodCard";
import { detectAndParseFoodLog } from "../diary/food-log-parser";

// ── CUSTOM PREMIUM RENDERERS ──

const ScoreBadge = ({ score, reason }: { score: number; reason: string }) => {
  let colorClass = "bg-red-50 text-red-700 border-red-200";
  let dotColor = "bg-red-500";
  let label = "Низкий"; // Poor
  
  if (score >= 86) {
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotColor = "bg-emerald-500";
    label = "Идеально"; // Ideal
  } else if (score >= 70) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    dotColor = "bg-amber-500";
    label = "Хорошо"; // Good
  } else if (score >= 40) {
    colorClass = "bg-orange-50 text-orange-700 border-orange-200";
    dotColor = "bg-orange-500";
    label = "Средне"; // Average
  }

  return (
    <div className={`my-6 p-5 rounded-2xl border ${colorClass} shadow-sm overflow-hidden relative`}>
      <div className="flex items-center space-x-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white font-bold text-xl shadow-sm border border-inherit`}>
          {score}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`}></span>
            <p className="font-bold uppercase tracking-wider text-[11px] opacity-80">{label} Health Score</p>
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
  const t = type?.toLowerCase() || "";
  const isVitamin = t.includes('vit') || t.includes('вит');
  const isMineral = t.includes('min') || t.includes('мин') || t.includes('жел') || t.includes('цинк') || t.includes('магн');
  
  let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  if (isVitamin) colorClass = "bg-purple-50 text-purple-700 border-purple-200";
  else if (isMineral) colorClass = "bg-blue-50 text-blue-700 border-blue-200";
  
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[13px] font-semibold border ${colorClass} mx-0.5 my-0 transition-all hover:scale-105 cursor-default shadow-sm`}>
      {children}
    </span>
  );
};

const AssistantMessageContent = ({ content }: { content: string }) => {
  // 1. Filter out <think> blocks
  let processed = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  // 2. Remove backslashes before formatting characters
  processed = processed.replace(/\\([<>\*\_!#\(\)\[\]\-\.\+])/g, "$1");

  // 3. Extract Food Log if present (only if <meal_score> tag exists — prevents phantom cards from recommendations)
  const hasMealScore = /<meal_score\s/.test(processed);
  const foodLog = hasMealScore ? detectAndParseFoodLog(processed, new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) : null;
  
  // 4. Strip technical food log string if detected
  if (foodLog) {
    // We already have the parsed data, now we just need to remove the "Записал..." part from the display text
    // The detectAndParseFoodLog utility returns the comment which has the log stripped.
    processed = foodLog.comment;
  }

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
  const mealScoreRegex = /<meal_score\s+score="(\d+)"\s+reason="([^"]+)"\s*\/>/g;
  const nutrRegex = /<nut[a-z]*\s+[^>]*?type=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/nut[a-z]*>/gi;

  const allMatches: { index: number; length: number; component: React.ReactNode }[] = [];
  let match;

  mealScoreRegex.lastIndex = 0;
  while ((match = mealScoreRegex.exec(processed)) !== null) {
    allMatches.push({ index: match.index, length: match[0].length, component: <ScoreBadge key={`score-${match.index}`} score={parseInt(match[1])} reason={match[2]} /> });
  }

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
      {foodLog && (
        <div className="my-2">
          <FoodCard {...foodLog.cardProps} />
        </div>
      )}
      <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-ink-muted/90">
        {fragments}
      </div>
    </div>
  );
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
};

export default function AiAssistantView({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialization flags
  const [isMounted, setIsMounted] = useState(false);
  const [zoomedImageId, setZoomedImageId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Привет! Я твой ИИ-друг. Буду рад помочь тебе с интерпретацией твоих данных и достижением твоих целей по здоровью. О чем поговорим?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use state for threadId so it survives renders but can be synced
  const [threadId, setThreadId] = useState<string>("");

  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

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
      const expectedContent = `Привет! Я ${profile.ai_name}. Буду рад помочь тебе с интерпретацией твоих данных и достижением твоих целей по здоровью. О чем поговорим?`;
      
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

  // 3. Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle the actual chat submission logic (separated so it can be called programmatically)
  const sendChatMessage = useCallback(async (content: string, thread: string, optionalImageUrl?: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      imageUrl: optionalImageUrl,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await apiClient.chat(content, thread, undefined, "assistant", optionalImageUrl);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.response,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("[AiAssistant] Chat Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Извините, произошла ошибка сети при обращении к ИИ. Пожалуйста, попробуйте позже.",
      };
      setMessages((prev) => [...prev, errorMsg]);
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
      const promptText = "Я загрузил фото ногтей. Дай подробную рекомендацию по извлеченным маркерам.";
      
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
    if (!input.trim() || isLoading || !threadId) return;

    const content = input.trim();
    setInput("");
    await sendChatMessage(content, threadId);
  };
  
  const handleClearChat = async () => {
    if (!threadId || isLoading) return;
    
    const confirmed = window.confirm("Вы уверены? Это полностью сотрет вашу историю общения с ИИ.");
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      await apiClient.deleteChatHistory("assistant");
      // Reset local state to initial welcome message
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Привет! Я твой ИИ-друг. Буду рад помочь тебе с интерпретацией твоих данных и достижением твоих целей по здоровью. О чем поговорим?",
        }
      ]);
    } catch (error) {
      console.error("[AiAssistant] Clear Error:", error);
      alert("Не удалось очистить историю чата. Пожалуйста, попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[500px] sm:h-[600px] flex-col overflow-hidden rounded-xl border border-cloud-dark bg-white shadow-sm">
      {/* Header with Clear Button */}
      <div className="flex items-center justify-between border-b border-cloud px-4 py-3 bg-white">
        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wider">
          {profile?.ai_name || "ИИ-Помощник"}
        </h3>
        <button
          onClick={handleClearChat}
          disabled={isLoading || messages.length <= 1}
          className="p-2 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Очистить чат"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === "user"
                  ? "bg-primary-600 text-white rounded-br-none"
                  : "bg-cloud-light text-ink rounded-bl-none"
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
                    <AssistantMessageContent content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px]">{msg.content}</p>
                  )}
                </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-cloud-light px-4 py-3 text-ink shadow-sm rounded-bl-none">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-ink-muted"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-cloud p-3 sm:p-6 bg-cloud-light/30">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Задайте вопрос о здоровье..."
            className="flex-1 rounded-xl border-cloud-dark bg-white px-4 py-3 text-[15px] text-ink shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-3 sm:px-5 py-3 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-cloud-dark disabled:text-ink-muted disabled:shadow-none"
          >
            <span className="hidden sm:inline">Отправить</span>
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
