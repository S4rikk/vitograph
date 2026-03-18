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
    icon: "✋",
    title: "Ногти на ногах или руках",
    description: "Узнай скрытые дефициты витаминов и минералов. Делайте фото без лака, при хорошем освещении.",
    buttonLabel: "Сделать фото",
    bgColor: "bg-[#f5eefc]",
    iconColor: "text-[#a855f7]",
  },
  tongue: {
    icon: "👅",
    title: "Фотография языка",
    description: "Налет, трещины и отпечатки зубов могут говорить о проблемах с ЖКТ и дефиците B-витаминов.",
    buttonLabel: "Сделать фото",
    bgColor: "bg-[#fef2f2]",
    iconColor: "text-[#ef4444]",
  },
  skin: {
    icon: "🎭",
    title: "Лицо или проблемная кожа",
    description: "Сухость, акне или бледность могут быть признаками дефицита Омега-3, железа или гормонального дисбаланса.",
    buttonLabel: "Сделать фото",
    bgColor: "bg-[#f0fdf4]",
    iconColor: "text-[#22c55e]",
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
    <div className="flex flex-col p-6 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      {/* Header section (Icon & Title) */}
      <div className="flex items-center gap-4 mb-5">
        <div className={`w-[52px] h-[52px] shrink-0 ${config.bgColor} ${config.iconColor} rounded-2xl flex items-center justify-center text-2xl shadow-sm`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-[17px] font-extrabold text-[#001d3d] leading-tight">
            {config.title}
          </h3>
        </div>
      </div>
      
      {/* Description */}
      <div className="flex-1 mb-8">
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
        <div className="text-red-500 text-[13px] font-medium mb-4 p-3 bg-red-50 border border-red-100 rounded-xl leading-tight text-center">
          {error}
        </div>
      )}

      {/* Button */}
      <label
        htmlFor={`somatic-photo-upload-${type}`}
        className={isUploading
          ? "cursor-wait opacity-80 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 px-5 font-bold text-slate-400 transition-all text-center mt-auto"
          : "cursor-pointer flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#ecf9f8] hover:bg-[#dff5f3] active:scale-[0.98] px-5 font-bold text-[#009489] transition-all text-center mt-auto group"}
      >
        {isUploading ? (
          <span className="flex items-center gap-2 justify-center">
            <svg className="animate-spin h-5 w-5 text-[#009489]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Анализ...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {config.buttonLabel}
          </span>
        )}
      </label>
    </div>
  );
}
