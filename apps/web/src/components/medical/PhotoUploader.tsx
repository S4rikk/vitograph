"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/image-utils";
import { apiClient } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { Hand, ScanFace } from "lucide-react";

const TongueIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="8.5" y1="9" x2="8.51" y2="9" />
    <line x1="15.5" y1="9" x2="15.51" y2="9" />
    <path d="M8 13.5c1.5 1.5 6.5 1.5 8 0" />
    <path d="M9 14.2v2.8a3 3 0 1 0 6 0v-2.8" />
  </svg>
);

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
    icon: <Hand className="w-7 h-7" />,
    titleKey: "nailsTitle",
    descriptionKey: "nailsDescription",
    bgColor: "bg-[#c084fc]/10", // purple-400
    iconColor: "text-[#c084fc]",
  },
  tongue: {
    icon: <TongueIcon className="w-7 h-7" />,
    titleKey: "tongueTitle",
    descriptionKey: "tongueDescription",
    bgColor: "bg-[#f472b6]/10", // pink-400
    iconColor: "text-[#f472b6]",
  },
  skin: {
    icon: <ScanFace className="w-7 h-7" />,
    titleKey: "skinTitle",
    descriptionKey: "skinDescription",
    bgColor: "bg-[#34d399]/10", // emerald-400
    iconColor: "text-[#34d399]",
  },
};

export default function PhotoUploader({ type, onSuccess, onAnalysisComplete }: PhotoUploaderProps) {
  const t = useTranslations("medical");
  const tDiary = useTranslations("diary");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
      
      // Auto-collapse after success
      setIsExpanded(false);
    } catch (err: any) {
      console.error("Upload failed", err);
      setError(err.message || t("analysisError"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full min-h-[64px] flex items-center gap-4 px-5 bg-surface border border-border rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:border-cyan-300/50 active:scale-[0.98]"
      >
        <div className={`w-[44px] h-[44px] shrink-0 ${config.bgColor} ${config.iconColor} rounded-xl flex items-center justify-center text-xl shadow-sm`}>
          {config.icon}
        </div>
        <h3 className="text-[1.0625rem] font-bold text-ink leading-tight text-left flex-1">
          {t(config.titleKey)}
        </h3>
        <svg className="w-5 h-5 text-ink-muted/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none animate-in fade-in duration-300">
      {/* Invisible backdrop to capture clicks outside the modal and close it */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        onClick={() => setIsExpanded(false)}
      />

      {/* Main glass block */}
      <div className="relative pointer-events-auto flex flex-col w-full max-w-sm p-5 sm:p-6 rounded-[24px] bg-white/10 dark:bg-white/5 backdrop-blur-md backdrop-saturate-150 border-2 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_0_15px_rgba(59,130,246,0.15)] text-ink transition-all duration-300 animate-in zoom-in-95">
        
        {/* Background halo (Glassmorphism glow) */}
        <div 
          className="absolute pointer-events-none z-[-1]"
          style={{
            width: 'calc(100% + 80px)',
            height: 'calc(100% + 80px)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 40%, transparent 70%)`,
            filter: 'blur(30px)',
            willChange: 'transform, opacity'
          }}
        />
        
        {/* Header section (Icon & Title & Close) */}
        <div className="flex items-center justify-between mb-5 gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-[52px] h-[52px] shrink-0 ${config.bgColor} ${config.iconColor} rounded-2xl flex items-center justify-center text-2xl shadow-sm`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-[1.0625rem] font-extrabold text-ink leading-tight">
                {t(config.titleKey)}
              </h3>
            </div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 dark:bg-white/5 text-ink-muted hover:text-ink transition-colors active:scale-95"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Description */}
        <div className="flex-1 mb-8">
          <p className="text-[0.875rem] text-ink-muted leading-relaxed font-medium">
            {t(config.descriptionKey)}
          </p>
        </div>

        {/* Input for camera capture */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
          id={`somatic-photo-upload-camera-${type}`}
        />

        {/* Input for gallery selection */}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          ref={galleryInputRef}
          className="hidden"
          id={`somatic-photo-upload-gallery-${type}`}
        />

        {error && (
          <div className="text-red-500 text-[0.8125rem] font-medium mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl leading-tight text-center">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          {isUploading ? (
            <div className="cursor-wait opacity-80 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-white/10 dark:bg-white/5 border-2 border-white/10 px-5 font-bold text-ink-faint transition-all text-center">
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("analyzing")}
              </span>
            </div>
          ) : (
            <>
              {/* Take Photo Button */}
              <label
                htmlFor={`somatic-photo-upload-camera-${type}`}
                className="cursor-pointer flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 active:scale-[0.98] px-5 font-bold text-blue-400 transition-all text-center group"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("takePhoto")}
                </span>
              </label>

              {/* Choose from Gallery Button */}
              <label
                htmlFor={`somatic-photo-upload-gallery-${type}`}
                className="cursor-pointer flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-white/10 dark:bg-white/5 border border-white/10 hover:bg-white/20 active:scale-[0.98] px-5 font-bold text-ink-muted hover:text-ink transition-all text-center group"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {tDiary("chooseGallery").replace(/^[^\w\u0400-\u04FF\s]*/, "").trim()}
                </span>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
