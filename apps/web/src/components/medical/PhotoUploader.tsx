"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/image-utils";
import { apiClient } from "@/lib/api-client";
import { useTranslations } from "next-intl";

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
    titleKey: "nailsTitle",
    descriptionKey: "nailsDescription",
    bgColor: "bg-purple-500/10",
    iconColor: "text-purple-600",
  },
  tongue: {
    icon: "👅",
    titleKey: "tongueTitle",
    descriptionKey: "tongueDescription",
    bgColor: "bg-red-500/10",
    iconColor: "text-red-600",
  },
  skin: {
    icon: "🎭",
    titleKey: "skinTitle",
    descriptionKey: "skinDescription",
    bgColor: "bg-green-500/10",
    iconColor: "text-green-600",
  },
};

export default function PhotoUploader({ type, onSuccess, onAnalysisComplete }: PhotoUploaderProps) {
  const t = useTranslations("medical");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = UPLOADER_CONFIG[type];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("invalidImageFormat"));
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
      setError(err.message || t("analysisError"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col p-6 bg-surface rounded-3xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      {/* Header section (Icon & Title) */}
      <div className="flex items-center gap-4 mb-5">
        <div className={`w-[52px] h-[52px] shrink-0 ${config.bgColor} ${config.iconColor} rounded-2xl flex items-center justify-center text-2xl shadow-sm`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-[1.0625rem] font-extrabold text-ink leading-tight">
            {t(config.titleKey)}
          </h3>
        </div>
      </div>
      
      {/* Description */}
      <div className="flex-1 mb-8">
        <p className="text-[0.875rem] text-ink-muted leading-relaxed font-medium">
          {t(config.descriptionKey)}
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
        <div className="text-red-500 text-[0.8125rem] font-medium mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl leading-tight text-center">
          {error}
        </div>
      )}

      {/* Button */}
      <label
        htmlFor={`somatic-photo-upload-${type}`}
        className={isUploading
          ? "cursor-wait opacity-80 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-surface-muted border border-border px-5 font-bold text-ink-faint transition-all text-center mt-auto"
          : "cursor-pointer flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-primary-500/10 hover:bg-primary-500/20 active:scale-[0.98] px-5 font-bold text-primary-600 transition-all text-center mt-auto group"}
      >
        {isUploading ? (
          <span className="flex items-center gap-2 justify-center">
            <svg className="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t("analyzing")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t("takePhoto")}
          </span>
        )}
      </label>
    </div>
  );
}
