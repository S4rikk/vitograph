import React from "react";
import { MealScoreBadge } from "./MealScoreBadge";
import FoodCard from "./FoodCard";
import { detectAndParseFoodLog } from "./food-log-parser";
import { getMicronutrientColor } from "@/lib/food-diary/nutrient-colors";
import { useTranslations } from "next-intl";

type ChatMessageProps = {
  /** "user" for right-aligned, "system" for left-aligned. */
  variant: "user" | "system";
  /** Message text content. */
  text: string;
  /** Formatted timestamp string. */
  time: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  mealMicros?: Record<string, number>;
  /** Called when user confirms RED ZONE meal */
  onRedZoneConfirm?: (food: string, weight: string) => void;
  /** Called when user declines RED ZONE meal */
  onRedZoneReject?: () => void;
  /** URL of food photo (from photo analysis) */
  imageUrl?: string;
  mealData?: any;
};

// Logic moved to food-log-parser.ts

function parseNutrientTags(text: string) {
  if (!text) return text;

  const combinedRegex = /(<nut[a-z]*\s+[^>]*type[a-z]*=["']([^"']*)["'][^>]*>([\s\S]*?)<\/nut[a-z]*>)|(<meal_score\s+score="([^"]*)"(?:\s+reason="([\s\S]*?)")?\s*\/>)|(<meal_id\s+id="([^"]*)"\s*\/>)/gi;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // It's a <nutr> tag
      const typeStr = (match[2] || "").toLowerCase();
      const content = match[3];

      let colorClass = "";
      if (typeStr === "red" || typeStr === "high" || typeStr === "bad") {
        colorClass = "text-red-500 font-semibold";
      } else if (typeStr === "yellow" || typeStr === "medium" || typeStr === "warning") {
        colorClass = "text-yellow-600 font-semibold";
      } else if (typeStr === "green" || typeStr === "low" || typeStr === "good") {
        colorClass = "text-emerald-500 font-semibold";
      } else {
        // Zero КБЖУ Policy: macro tags no longer expected from LLM.
        // All other nutrient tags use micro-specific colors by content.
        const microColor = getMicronutrientColor(content);
        colorClass = microColor.text;
      }

      result.push(
        <span key={match.index} className={colorClass}>
          {content}
        </span>
      );
    } else if (match[4]) {
      // It's a <meal_score> tag
      const score = parseInt(match[5], 10);
      const reason = match[6];

      result.push(
        <div key={match.index} className="my-2">
          <MealScoreBadge score={score} reason={reason} />
        </div>
      );
    } else if (match[7]) {
      // It's a <meal_id> tag, do nothing (skip it to strip it)
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length > 0 ? result : text;
}

/**
 * A single chat bubble for the Food Diary.
 *
 * User messages are right-aligned with teal background.
 * System messages are left-aligned with grey background.
 */
export default function ChatMessage({
  variant,
  text,
  time,
  onDelete,
  onEdit,
  mealMicros,
  onRedZoneConfirm,
  onRedZoneReject,
  imageUrl,
  mealData,
}: ChatMessageProps) {
  const t = useTranslations("diary.chatMessage");
  const isUser = variant === "user";

  // ── Detect RED ZONE confirm tag ──
  const redZoneMatch = !isUser ? text.match(/<red_zone_confirm\s+food="([^"]*)"\s+weight="([^"]*)"\s*\/?>/) : null;
  const cleanedText = redZoneMatch ? text.replace(/<red_zone_confirm[^>]*\/?>/g, '').trim() : text;

  if (!isUser) {
    const parsed = detectAndParseFoodLog(text, time, mealData);
    if (parsed) {
      if (mealMicros && (!parsed.cardProps.micros || parsed.cardProps.micros.length < 2)) {
        parsed.cardProps.micros = Object.entries(mealMicros).map(([key, val]) => {
          const name = key.replace(/\s*\([^)]*\)\s*$/, '');
          const unit = key.match(/\(([^)]+)\)/)?.[1] || '';
          return {
            name,
            value: `${Number(val).toFixed(1)}${unit}`,
            type: 'micro'
          };
        });
      }
      console.log("[ChatMessage] CardProps:", parsed.cardProps);
      return (
        <div className="flex justify-start w-full">
          <FoodCard {...parsed.cardProps} imageUrl={imageUrl} onDelete={onDelete} onEdit={onEdit} />
        </div>
      );
    }
  }

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-2.5
          ${isUser
            ? "rounded-br-md bg-primary-600 text-white"
            : "rounded-bl-md bg-surface text-ink border border-border"
          }
        `}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{parseNutrientTags(cleanedText)}</div>
        {redZoneMatch && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
            <button
              onClick={() => onRedZoneConfirm?.(redZoneMatch[1], redZoneMatch[2])}
              className="flex-1 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 hover:bg-red-100 transition-colors"
            >
              🍽️ {t("addFood", { food: redZoneMatch[1] })}
            </button>
            <button
              onClick={() => onRedZoneReject?.()}
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              💚 {t("thinkAboutIt")}
            </button>
          </div>
        )}
        <p
          className={`
            mt-1 text-[0.625rem] text-right
            ${isUser ? "text-primary-200" : "text-ink-faint"}
          `}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
