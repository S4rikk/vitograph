"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import Image from "next/image";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

export default function AiAssistantView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialization flags
  const [isMounted, setIsMounted] = useState(false);
  const [zoomedImageId, setZoomedImageId] = useState<string | null>(null);

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

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-cloud-dark bg-white shadow-sm">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
                <p className="whitespace-pre-wrap text-[15px]">{msg.content}</p>
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
      <div className="border-t border-cloud p-4 sm:p-6 bg-cloud-light/30">
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
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-3 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-cloud-dark disabled:text-ink-muted disabled:shadow-none"
          >
            Отправить
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
