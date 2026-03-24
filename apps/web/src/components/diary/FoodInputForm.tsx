"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { compressImage } from "@/lib/image-utils";
import { apiClient } from "@/lib/api-client";
import type { FoodRecognitionResult } from "@/lib/api-client";
import { MealScoreBadge } from "./MealScoreBadge";

type FoodInputFormProps = {
  /** Called when the form is submitted with valid data. */
  onSubmit: (name: string, weight: number, nutritionalContext?: any) => void;
  /** Called after successful food photo recognition to refresh meal list. */
  onPhotoResult?: (result: FoodRecognitionResult) => void;
};

/** Color map for reaction type notifications. */
const REACTION_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  positive: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800" },
  neutral: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  warning: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800" },
  restriction_violation: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
};

/**
 * Structured food input form with two fields + camera button:
 * - "Название блюда" (dish name) + 📷 camera
 * - "Вес (г)" (weight in grams)
 */
export default function FoodInputForm({ onSubmit, onPhotoResult }: FoodInputFormProps) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState<FoodRecognitionResult | null>(null);
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  // Force remount of file inputs to prevent mobile browsers from caching the picker type
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent));
  }, []);

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
          fullVisionResult: photoResult, // Pass the ENTIRE object
          userEnteredWeight: parsedWeight,
          source: "photo"
        };
      }

      onSubmit(trimmedName, parsedWeight, nutritionalContext);
      setName("");
      setWeight("");
      setPhotoResult(null);
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

  const handleCameraClick = useCallback(() => {
    if (isMobile) {
      setShowPhotoMenu(true);
    } else {
      galleryRef.current?.click();
    }
  }, [isMobile]);

  const isValid = name.trim().length > 0 && !isNaN(parseInt(weight, 10)) && parseInt(weight, 10) > 0;

  return (
    <div className="space-y-2">
      {/* ── Photo Analysis Notification ─────────────────────────── */}
      {photoResult && (
        <div
          className={`rounded-xl border p-3 text-sm ${REACTION_STYLES[photoResult.reaction_type]?.bg || "bg-gray-50"} ${REACTION_STYLES[photoResult.reaction_type]?.border || "border-gray-200"} ${REACTION_STYLES[photoResult.reaction_type]?.text || "text-gray-800"}`}
        >
          <div className="flex justify-between items-start mb-2 gap-2">
            <p className="font-medium">
              {photoResult.items.map((i) => `${i.name_ru} (~${i.estimated_weight_g}г)`).join(", ")}
            </p>
            <MealScoreBadge score={photoResult.meal_quality_score} reason={photoResult.meal_quality_reason} />
          </div>
          <p className="text-xs opacity-80">
            {photoResult.meal_summary.total_calories_kcal} ккал · Б {photoResult.meal_summary.total_protein_g}г · Ж {photoResult.meal_summary.total_fat_g}г · У {photoResult.meal_summary.total_carbs_g}г
          </p>
          <p className="mt-1 text-xs">{photoResult.health_reaction}</p>
          {photoResult.llmError && (
            <p className="mt-1 text-xs opacity-60">Ошибка: {photoResult.llmError}</p>
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
          Анализирую фото…
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 sm:gap-3 rounded-2xl border border-border bg-white p-2 sm:p-3 shadow-sm"
      >
        {/* Dish name and Camera */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="food-name"
            className="block text-[10px] sm:text-xs font-medium text-ink-muted mb-1 sm:mb-2 flex items-center justify-between gap-2"
          >
            <span>Блюдо</span>
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={isAnalyzing}
              className={`p-2 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 shadow-sm ${isAnalyzing ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Сфотографировать еду"
            >
              <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinejoin="round" strokeWidth="2" d="M4 18V8a1 1 0 0 1 1-1h1.5l1.707-1.707A1 1 0 0 1 8.914 5h6.172a1 1 0 0 1 .707.293L17.5 7H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
                <path stroke="currentColor" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
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
          <div className="relative">
            <textarea
              ref={nameRef}
              id="food-name"
              placeholder="Овсянка"
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
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-ink placeholder-ink-faint transition-colors duration-150 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 max-h-[150px] min-h-[44px] overflow-y-auto resize-none"
            />
          </div>
        </div>

        {/* Weight */}
        <div className="w-24 flex-shrink-0">
          <label
            htmlFor="food-weight"
            className="block text-[10px] sm:text-xs font-medium text-ink-muted mb-1"
          >
            Вес (г)
          </label>
          <input
            id="food-weight"
            type="number"
            min={1}
            placeholder="200"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-ink placeholder-ink-faint transition-colors duration-150 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid}
          aria-label="Отправить"
          className={`cursor-pointer flex-shrink-0 rounded-xl p-3 sm:p-2.5 transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${isValid ? "bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md active:scale-95" : "bg-surface-hover text-ink-faint cursor-not-allowed"}`}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
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
          <div className="photo-action-sheet relative z-10 w-full max-w-md rounded-t-2xl bg-white p-4 pb-8 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />
            <h3 className="text-center text-sm font-semibold text-ink mb-4">
              Добавить фото еды
            </h3>
            <button
              type="button"
              onClick={() => {
                cameraRef.current?.click();
                setTimeout(() => setShowPhotoMenu(false), 300);
              }}
              className="w-full rounded-xl bg-primary-50 p-4 text-left text-sm font-medium text-primary-700 hover:bg-primary-100 mb-2 flex items-center gap-3"
            >
              📸 Сделать снимок
            </button>
            <button
              type="button"
              onClick={() => {
                galleryRef.current?.click();
                setTimeout(() => setShowPhotoMenu(false), 300);
              }}
              className="w-full rounded-xl bg-surface-muted p-4 text-left text-sm font-medium text-ink hover:bg-surface-hover mb-2 flex items-center gap-3"
            >
              🖼️ Выбрать из галереи
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoMenu(false)}
              className="w-full rounded-xl p-3 text-center text-sm text-ink-muted hover:bg-surface-hover"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
