"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { compressImage } from "@/lib/image-utils";
import { apiClient } from "@/lib/api-client";
import type { FoodRecognitionResult, LabelScannerOutput } from "@/lib/api-client";
import { MealScoreBadge } from "./MealScoreBadge";
import { X, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
type FoodInputFormProps = {
  /** Called when the form is submitted with valid data. */
  onSubmit: (name: string, weight: number, nutritionalContext?: any) => void;
  /** Called after successful food photo recognition to refresh meal list. */
  onPhotoResult?: (result: FoodRecognitionResult) => void;
  /** Emits preview active state to parent layout */
  onPreviewStateChange?: (isActive: boolean) => void;
  /** Portal container for the preview card to span the whole chat */
  previewContainer?: HTMLDivElement | null;
};

const REACTION_STYLES: Record<string, { bg: string; border: string; glow: string; haloColor: string }> = {
  positive: { bg: "bg-[#0d0f0e]/55 backdrop-blur-xl backdrop-saturate-150", border: "border-2 border-[#2ed585]/40", glow: "shadow-[0_0_20px_rgba(46,213,133,0.3),inset_0_0_15px_rgba(46,213,133,0.15)]", haloColor: "rgba(46,213,133,0.15)" },
  neutral: { bg: "bg-[#0d0e10]/55 backdrop-blur-xl backdrop-saturate-150", border: "border-2 border-blue-500/40", glow: "shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_0_15px_rgba(59,130,246,0.15)]", haloColor: "rgba(59,130,246,0.15)" },
  warning: { bg: "bg-[#100f0d]/55 backdrop-blur-xl backdrop-saturate-150", border: "border-2 border-yellow-500/40", glow: "shadow-[0_0_20px_rgba(234,179,8,0.3),inset_0_0_15px_rgba(234,179,8,0.15)]", haloColor: "rgba(234,179,8,0.15)" },
  restriction_violation: { bg: "bg-[#100d0d]/55 backdrop-blur-xl backdrop-saturate-150", border: "border-2 border-red-500/40", glow: "shadow-[0_0_20px_rgba(239,68,68,0.3),inset_0_0_15px_rgba(239,68,68,0.15)]", haloColor: "rgba(239,68,68,0.15)" },
};

/**
 * Structured food input form with two fields + camera button:
 * - "Название блюда" (dish name) + 📷 camera
 * - "Вес (г)" (weight in grams)
 */
export default function FoodInputForm({ onSubmit, onPhotoResult, onPreviewStateChange, previewContainer }: FoodInputFormProps) {
  const t = useTranslations('diary');
  const tCommon = useTranslations('common');
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState<FoodRecognitionResult | null>(null);
  const [isAnalyzingLabel, setIsAnalyzingLabel] = useState(false);
  const [labelResult, setLabelResult] = useState<LabelScannerOutput | null>(null);
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const labelCameraRef = useRef<HTMLInputElement>(null);
  const labelGalleryRef = useRef<HTMLInputElement>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  // Force remount of file inputs to prevent mobile browsers from caching the picker type
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent));
  }, []);

  // Inform parent layout when preview opens/closes to show full-screen backdrop
  useEffect(() => {
    if (onPreviewStateChange) {
      onPreviewStateChange(!!photoResult);
    }
  }, [photoResult, onPreviewStateChange]);

  // Restore photo analysis draft from sessionStorage (survives page reload)
  useEffect(() => {
    try {
      const savedPhotoResult = sessionStorage.getItem("vitograph_diary_photoResult");
      const savedName = sessionStorage.getItem("vitograph_diary_name");
      const savedWeight = sessionStorage.getItem("vitograph_diary_weight");
      
      if (savedPhotoResult) {
        setPhotoResult(JSON.parse(savedPhotoResult));
        if (savedName) setName(savedName);
        if (savedWeight) setWeight(savedWeight);
      }
    } catch (e) {
      console.error("[FoodInputForm] Failed to restore draft:", e);
    }
  }, []);

  // Sync photo analysis state to sessionStorage
  useEffect(() => {
    if (photoResult) {
      sessionStorage.setItem("vitograph_diary_photoResult", JSON.stringify(photoResult));
      sessionStorage.setItem("vitograph_diary_name", name);
      sessionStorage.setItem("vitograph_diary_weight", weight);
    }
  }, [photoResult, name, weight]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const parsedWeight = parseInt(weight, 10);

      if (!trimmedName || isNaN(parsedWeight) || parsedWeight <= 0) {
        return;
      }

      let nutritionalContext: any = null;
      if (photoResult) {
        nutritionalContext = {
          fullVisionResult: photoResult,
          userEnteredWeight: parsedWeight,
          source: "photo",
          imageUrl: photoResult.imageUrl, // Pass photo URL so FoodCard can display it
        };
      }

      // Clear cached draft
      sessionStorage.removeItem("vitograph_diary_photoResult");
      sessionStorage.removeItem("vitograph_diary_name");
      sessionStorage.removeItem("vitograph_diary_weight");

      onSubmit(trimmedName, parsedWeight, nutritionalContext);
      setName("");
      setWeight("");
      setPhotoResult(null);
      setLabelResult(null);
      nameRef.current?.focus();
    },
    [name, weight, onSubmit, photoResult],
  );

  const handlePhotoCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        return;
      }

      try {
        setIsAnalyzing(true);
        // Clear previous draft
        sessionStorage.removeItem("vitograph_diary_photoResult");
        sessionStorage.removeItem("vitograph_diary_name");
        sessionStorage.removeItem("vitograph_diary_weight");

        setPhotoResult(null);

        // 1. Compress image to max 1024px
        const base64Image = await compressImage(file, 1024);

        // 2. Send to backend for vision analysis
        const result = await apiClient.analyzeFood(base64Image);

        // 3. Store result for notification display
        setPhotoResult(result);

        // 4. Auto-fill form with total recognized weight and items names
        if (result.items.length > 0) {
          const totalWeight = result.items.reduce((sum, i) => sum + (i.estimated_weight_g || 0), 0);
          setName(result.items.map(i => i.name_ru).join(", "));
          setWeight(String(totalWeight));
        }

        // 5. Notify parent to refresh meal list
        if (onPhotoResult) {
          onPhotoResult(result);
        }
      } catch (err: any) {
        console.error("[FoodVision] Photo analysis failed:", err);
        setPhotoResult(null);
      } finally {
        setIsAnalyzing(false);
        // Destroy and recreate the inputs to reliably reset browser file picker state
        setFileInputKey(Date.now());
      }
    },
    [onPhotoResult],
  );

  const handleLabelCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) return;

      try {
        setIsAnalyzingLabel(true);
        setLabelResult(null);

        const base64Image = await compressImage(file, 1024);
        const result = await apiClient.analyzeLabel(base64Image);

        setLabelResult(result);

        if (result.product_name && result.product_name !== "Неизвестно") {
          setName((prev) => prev ? `${result.product_name}, ${prev}` : result.product_name);
        }
      } catch (err: any) {
        console.error("[LabelScanner] Label analysis failed:", err);
      } finally {
        setIsAnalyzingLabel(false);
        setFileInputKey(Date.now());
      }
    },
    [],
  );

  const handleCameraClick = useCallback(() => {
    if (isMobile) {
      setShowPhotoMenu(true);
    } else {
      galleryRef.current?.click();
    }
  }, [isMobile]);

  const handleLabelClick = useCallback(() => {
    if (isMobile) {
      setShowLabelMenu(true);
    } else {
      labelGalleryRef.current?.click();
    }
  }, [isMobile]);

  const isValid = name.trim().length > 0 && !isNaN(parseInt(weight, 10)) && parseInt(weight, 10) > 0;

  const reactionStyle = REACTION_STYLES[photoResult?.reaction_type ?? ''] ?? REACTION_STYLES.positive;

  const previewContent = photoResult && (
    <div className="absolute inset-0 z-[100] flex flex-col pointer-events-auto">
      {/* Transparent overlay — NO blur, content behind is fully visible */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>

      {/* Floating Card Container */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-5 overflow-y-auto">
        {/* Gradient blur halo around the card — fades outward */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 'calc(100% + 80px)',
            height: 'calc(100% + 80px)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(ellipse at center, ${reactionStyle.haloColor} 40%, transparent 70%)`,
            filter: 'blur(30px)',
          }}
        />
        <div
          className={`relative w-full max-w-md flex flex-col p-4 sm:p-5 rounded-[24px] border ${reactionStyle.bg} ${reactionStyle.border} ${reactionStyle.glow} text-ink`}
        >

          <div className="flex gap-4">
            {/* Left: Thumbnail */}
            {photoResult.imageUrl && (
              <div className="shrink-0">
                <img
                  src={photoResult.imageUrl}
                  alt={t('takePhoto')}
                  className="w-[88px] h-[88px] object-cover rounded-[20px] shadow-lg border border-white/5"
                />
              </div>
            )}
            
            {/* Right: Title, Score, Italic Summary */}
            <div className="flex flex-col flex-1 min-w-0">
              <h3 className="font-bold text-[15px] leading-tight mb-2">
                {photoResult.items.map((i) => `${i.name_ru} (~${i.estimated_weight_g}г)`).join(", ")}
              </h3>
              <MealScoreBadge score={photoResult.meal_quality_score} />
              {photoResult.meal_quality_reason && (
                <p className="mt-1.5 text-[11px] italic text-ink/60 leading-tight">
                  {photoResult.meal_quality_reason}
                </p>
              )}
            </div>
          </div>
          
          {/* Main Reaction Text — no background, just plain text */}
          {photoResult.health_reaction && (
            <p className="mt-4 text-[13px] leading-relaxed text-ink/90">
              {photoResult.health_reaction}
            </p>
          )}

          {/* GI/GL separate capsules + Trash in one row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {photoResult.items.length > 0 && photoResult.items.map((item, idx) => {
              const cls = item.glycemic_class ?? "flat";
              const styleMap = {
                flat:     { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
                moderate: { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400" },
                spike:    { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400" },
              } as const;
              const s = styleMap[cls] ?? styleMap.flat;
              const gi = item.glycemic_index ?? 0;
              const gl = item.glycemic_load ?? 0;
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className={`px-3 py-1.5 rounded-full text-[12px] font-bold border ${s.border} ${s.bg} ${s.text}`}>
                    GI {gi}
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-[12px] font-bold border ${s.border} ${s.bg} ${s.text}`}>
                    GL {gl.toFixed(1)}
                  </div>
                </div>
              );
            })}

            {/* Trash button — same row as GI/GL */}
            <button
              type="button"
              onClick={() => {
                setPhotoResult(null);
                setName("");
                setWeight("");
                sessionStorage.removeItem("vitograph_diary_photoResult");
                sessionStorage.removeItem("vitograph_diary_name");
                sessionStorage.removeItem("vitograph_diary_weight");
              }}
              className="ml-auto p-2 rounded-full hover:bg-white/10 text-ink/40 hover:text-red-500 transition-colors shrink-0"
              title={t('cancelAndClear')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          {photoResult.llmError && (
            <p className="mt-2 text-xs opacity-60 text-red-500">Ошибка: {photoResult.llmError}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* ── Photo Analysis Notification ─────────────────────────── */}
      {previewContent && previewContainer ? createPortal(previewContent, previewContainer) : previewContent}

      {/* ── Label Scanner Notification ─────────────────────────── */}
      {labelResult && (
        <div
          className={`rounded-xl border p-3 text-sm flex flex-col gap-2 max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-black/10 hover:scrollbar-thumb-black/20 ${
            labelResult.verdict === "GREEN"
              ? "bg-green-50 border-green-200 text-green-800"
              : labelResult.verdict === "YELLOW"
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <p className="font-semibold text-[0.9375rem]">{labelResult.product_name}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold leading-none flex items-center shrink-0 ${
              labelResult.verdict === "GREEN" ? "bg-green-100 text-green-800" :
              labelResult.verdict === "YELLOW" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              {labelResult.verdict === "GREEN" ? "Можно" :
               labelResult.verdict === "YELLOW" ? "Осторожно" : "Нельзя"}
            </span>
          </div>
          <p className="text-xs opacity-90 leading-relaxed font-medium">
            {labelResult.verdict_reason}
          </p>
          
          {labelResult.e_codes && labelResult.e_codes.length > 0 && (
            <div className="mt-1 space-y-1">
              <p className="text-[0.625rem] font-bold opacity-60 uppercase tracking-wider mb-1">Е-добавки</p>
              {labelResult.e_codes.map((eCode, idx) => (
                <div key={idx} className="flex flex-col text-xs bg-black/5 p-1.5 rounded text-ink">
                  <span className="font-semibold flex items-center gap-1">
                    <span className={
                      eCode.danger_level === "HIGH" ? "text-red-600" :
                      eCode.danger_level === "MEDIUM" ? "text-yellow-600" : "text-green-600"
                    }>
                      {eCode.code}
                    </span> 
                    - {eCode.name}
                  </span>
                  <span className="opacity-80 text-[0.6875rem] leading-tight">{eCode.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Analyzing Spinner ───────────────────────────────────── */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-700">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {t('analyzingFood')}
        </div>
      )}

      {isAnalyzingLabel && (
        <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {t('analyzingLabel')}
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-1.5 rounded-2xl border border-white/70 dark:border-white/30 bg-surface/80 backdrop-blur-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_1px_0_2px_rgba(255,255,255,0.5),inset_-1px_0_2px_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(255,255,255,0.2),0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_1px_0_2px_rgba(255,255,255,0.15),inset_-1px_0_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05),0_10px_20px_-10px_rgba(0,0,0,0.5)] px-3 py-2"
      >
        {/* Row 1: Dish name — full width */}
        <div className="w-full">
          <label htmlFor="food-name" className="block text-xs font-medium text-ink-muted mb-1">
            {t('dishName')}
          </label>
          {/* Camera — with capture (forces camera on mobile) */}
          <input
            key={`camera-${fileInputKey}`}
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="absolute w-0 h-0 opacity-0 -z-10 pointer-events-none"
            aria-hidden="true"
          />
          {/* Gallery — without capture (opens file picker / gallery) */}
          <input
            key={`gallery-${fileInputKey}`}
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoCapture}
            className="absolute w-0 h-0 opacity-0 -z-10 pointer-events-none"
            aria-hidden="true"
          />
          {/* Label specific inputs */}
          <input
            key={`label-camera-${fileInputKey}`}
            ref={labelCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleLabelCapture}
            className="absolute w-0 h-0 opacity-0 -z-10 pointer-events-none"
            aria-hidden="true"
          />
          <input
            key={`label-gallery-${fileInputKey}`}
            ref={labelGalleryRef}
            type="file"
            accept="image/*"
            onChange={handleLabelCapture}
            className="absolute w-0 h-0 opacity-0 -z-10 pointer-events-none"
            aria-hidden="true"
          />
          <textarea
            ref={nameRef}
            id="food-name"
            placeholder={t('dishName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={1}
            style={{ fieldSizing: "content" } as any}
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1 text-sm text-ink placeholder-ink-faint transition-colors duration-150 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-100 max-h-[150px] min-h-[30px] overflow-y-auto resize-none"
          />
        </div>

        {/* Row 2: Camera | Label | Weight | Submit */}
        <div className="flex items-end gap-2">
          {/* Camera button */}
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-xs font-medium text-ink-muted">{t('dishName')}</span>
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={isAnalyzing || isAnalyzingLabel}
              className={`h-[30px] w-full rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 shadow-sm flex items-center justify-center ${isAnalyzing || isAnalyzingLabel ? "opacity-50 cursor-not-allowed" : ""}`}
              title={t('takePhoto')}
            >
              <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinejoin="round" strokeWidth="2" d="M4 18V8a1 1 0 0 1 1-1h1.5l1.707-1.707A1 1 0 0 1 8.914 5h6.172a1 1 0 0 1 .707.293L17.5 7H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
                <path stroke="currentColor" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>

          {/* Label Scanner button */}
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-xs font-medium text-ink-muted">{t('labelScanner')}</span>
            <button
              type="button"
              onClick={handleLabelClick}
              disabled={isAnalyzing || isAnalyzingLabel}
              className={`h-[30px] w-full rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-200 shadow-sm flex items-center justify-center ${isAnalyzing || isAnalyzingLabel ? "opacity-50 cursor-not-allowed" : ""}`}
              title={t('scanLabel')}
            >
              <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 12h14M5 16h14m-3.5 4H19a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4.5"/>
              </svg>
            </button>
          </div>

          {/* Weight input */}
          <div className="flex-1 flex flex-col gap-0.5">
            <label htmlFor="food-weight" className="text-xs font-medium text-ink-muted">
              {t('weightLabel')}
            </label>
            <input
              id="food-weight"
              type="number"
              min={1}
              placeholder="200"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-1 text-sm text-ink placeholder-ink-faint transition-colors duration-150 focus:border-primary-400 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-100 h-[30px]"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isValid}
            aria-label={t('send')}
            className={`cursor-pointer flex-shrink-0 rounded-xl transition-all duration-200 min-h-[30px] min-w-[30px] flex items-center justify-center self-end ${isValid ? "bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md active:scale-95" : "bg-surface-hover text-ink-faint cursor-not-allowed"}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
      {/* ── Photo Source Action Sheet (mobile only) ────────────── */}
      {showPhotoMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowPhotoMenu(false)}
          />
          {/* Menu */}
          <div className="photo-action-sheet relative z-10 w-full max-w-md rounded-t-2xl bg-surface p-4 pb-8 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
            <h3 className="text-center text-sm font-semibold text-ink mb-4">
              {t('photoMenuTitle')}
            </h3>
            <button
              type="button"
              onClick={() => {
                cameraRef.current?.click();
                setTimeout(() => setShowPhotoMenu(false), 300);
              }}
              className="w-full rounded-xl bg-primary-50 p-4 text-left text-sm font-medium text-primary-700 hover:bg-primary-100 mb-2 flex items-center gap-3"
            >
              {t('takePicture')}
            </button>
            <button
              type="button"
              onClick={() => {
                galleryRef.current?.click();
                setTimeout(() => setShowPhotoMenu(false), 300);
              }}
              className="w-full rounded-xl bg-surface-muted p-4 text-left text-sm font-medium text-ink hover:bg-surface-hover mb-2 flex items-center gap-3"
            >
              {t('chooseGallery')}
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoMenu(false)}
              className="w-full rounded-xl p-3 text-center text-sm text-ink-muted hover:bg-surface-hover"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Label Action Sheet (mobile only) ────────────── */}
      {showLabelMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowLabelMenu(false)}
          />
          {/* Menu */}
          <div className="photo-action-sheet relative z-10 w-full max-w-md rounded-t-2xl bg-surface p-4 pb-8 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
            <h3 className="text-center text-sm font-semibold text-ink mb-4">
              {t('labelMenuTitle')}
            </h3>
            <button
              type="button"
              onClick={() => {
                labelCameraRef.current?.click();
                setTimeout(() => setShowLabelMenu(false), 300);
              }}
              className="w-full rounded-xl bg-purple-50 p-4 text-left text-sm font-medium text-purple-700 hover:bg-purple-100 mb-2 flex items-center gap-3"
            >
              {t('takePicture')}
            </button>
            <button
              type="button"
              onClick={() => {
                labelGalleryRef.current?.click();
                setTimeout(() => setShowLabelMenu(false), 300);
              }}
              className="w-full rounded-xl bg-surface-muted p-4 text-left text-sm font-medium text-ink hover:bg-surface-hover mb-2 flex items-center gap-3"
            >
              {t('chooseGallery')}
            </button>
            <button
              type="button"
              onClick={() => setShowLabelMenu(false)}
              className="w-full rounded-xl p-3 text-center text-sm text-ink-muted hover:bg-surface-hover"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
