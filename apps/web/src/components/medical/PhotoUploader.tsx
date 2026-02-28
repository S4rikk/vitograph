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
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-2xl border border-divider">
      <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4 text-2xl">
        {config.icon}
      </div>
      <h3 className="text-lg font-semibold text-ink mb-2 text-center">
        {config.title}
      </h3>
      <p className="text-sm text-ink-muted text-center mb-6 max-w-sm">
        {config.description}
      </p>

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
        <div className="text-red-500 text-sm mb-4 text-center px-4 py-2 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <label
        htmlFor={`somatic-photo-upload-${type}`}
        className={isUploading
          ? "cursor-not-allowed opacity-50 inline-flex h-12 w-full max-w-[280px] items-center justify-center rounded-xl bg-primary-500 px-6 font-medium text-white shadow-sm transition-all"
          : "cursor-pointer inline-flex h-12 w-full max-w-[280px] items-center justify-center rounded-xl bg-primary-500 px-6 font-medium text-white shadow-sm transition-all hover:bg-primary-600 active:scale-95"}
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Анализирую фото...
          </span>
        ) : (
          config.buttonLabel
        )}
      </label>
    </div>
  );
}
