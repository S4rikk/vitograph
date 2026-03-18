"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/image-utils";
import { apiClient } from "@/lib/api-client";

interface SomaticAnalysisResult {
  markers: string[];
  interpretation: string;
  confidence: number;
  imageUrl: string;
}

interface PhotoUploaderProps {
  type: "nails" | "tongue" | "skin";
  onSuccess?: () => void;
  onAnalysisComplete?: (result: SomaticAnalysisResult) => void;
}

const UPLOADER_CONFIG = {
  nails: {
    icon: "📸",
    title: "Сфотографируй ногти на ногах (или руках)",
    description: "Узнай скрытые дефициты витаминов и минералов. Предпочтительно сделать фото ногтей на ногах. Убедись, что на них нет лака, а фото сделано при хорошем освещении.",
    buttonLabel: "Сделать фото ногтей",
  },
  tongue: {
    icon: "👅",
    title: "Сфотографируй язык",
    description: "Налет, трещины и отпечатки зубов могут говорить о проблемах с ЖКТ, дефиците B-витаминов или анемии.",
    buttonLabel: "Сделать фото языка",
  },
  skin: {
    icon: "👤",
    title: "Сфотографируй лицо (или проблемный участок кожи)",
    description: "Сухость, акне или бледность могут быть признаками дефицита Омега-3, железа или гормонального дисбаланса.",
    buttonLabel: "Сделать фото кожи",
  },
};

export default function PhotoUploader({ type, onSuccess, onAnalysisComplete }: PhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = UPLOADER_CONFIG[type];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Пожалуйста, загрузите изображение (JPEG, PNG).");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // 1. Compress image to max 1024px
      const base64Image = await compressImage(file, 1024);

      // 2. Send to backend
      const response = await apiClient.analyzeSomatic(base64Image, type);

      // 3. Optional callback
      if (onSuccess) onSuccess();

      // 4. Show results in place (pass to parent)
      if (onAnalysisComplete) {
        onAnalysisComplete({
          markers: response.markers || [],
          interpretation: response.interpretation || "",
          confidence: response.confidence ?? 0,
          imageUrl: response.imageUrl || "",
        });
      }
    } catch (err: any) {
      console.error("Upload failed", err);
      setError(err.message || "Ошибка при анализе фото. Попробуйте еще раз.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="group flex flex-col p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-200 transition-all duration-300 h-full relative overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-100 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-100 pointer-events-none"></div>
      
      {/* Header section (Icon & Title) */}
      <div className="flex items-start gap-4 mb-4 relative z-10">
        <div className="w-[52px] h-[52px] shrink-0 bg-gradient-to-br from-cyan-50 to-white text-cyan-600 rounded-[14px] flex items-center justify-center text-2xl border border-cyan-100/60 shadow-[0_2px_8px_-2px_rgba(6,182,212,0.15)]">
          {config.icon}
        </div>
        <div className="flex-1 pt-1">
          <h3 className="text-[17px] font-bold text-slate-800 leading-tight">
            {config.title}
          </h3>
        </div>
      </div>
      
      {/* Description */}
      <div className="relative z-10 flex-1 mb-6">
        <p className="text-[14px] text-slate-500 leading-relaxed font-medium">
          {config.description}
        </p>
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
        id={`somatic-photo-upload-${type}`}
      />

      {error && (
        <div className="text-red-600 text-[13px] font-medium mb-4 p-3 bg-red-50/80 border border-red-100 rounded-xl relative z-10 leading-tight">
          {error}
        </div>
      )}

      {/* Button */}
      <label
        htmlFor={`somatic-photo-upload-${type}`}
        className={isUploading
          ? "cursor-wait opacity-80 flex min-h-[46px] h-auto py-2.5 w-full items-center justify-center rounded-xl bg-slate-100 border border-slate-200 px-5 font-semibold text-slate-500 shadow-sm transition-all text-center mt-auto relative z-10"
          : "cursor-pointer flex min-h-[46px] h-auto py-2.5 w-full items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 px-5 font-semibold text-white shadow-[0_4px_12px_-4px_rgba(6,182,212,0.4)] transition-all hover:-translate-y-[1px] text-center mt-auto relative z-10"}
      >
        {isUploading ? (
          <span className="flex items-center gap-2 justify-center">
            <svg className="animate-spin h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Анализирую фото...
          </span>
        ) : (
          <span>{config.buttonLabel}</span>
        )}
      </label>
    </div>
  );
}
