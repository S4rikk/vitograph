import React from "react";
import { MealScoreBadge } from "./MealScoreBadge";
import FoodCard from "./FoodCard";
import { detectAndParseFoodLog } from "./food-log-parser";
import { nutrientColors } from "@/lib/food-diary/nutrient-colors";

type ChatMessageProps = {
  /** "user" for right-aligned, "system" for left-aligned. */
  variant: "user" | "system";
  /** Message text content. */
  text: string;
  /** Formatted timestamp string. */
  time: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
};

// Logic moved to food-log-parser.ts

function parseNutrientTags(text: string) {
  if (!text) return text;

  const combinedRegex = /(<nut[a-z]*\s+[^>]*type=["']([^"']*)["'][^>]*>([\s\S]*?)<\/nut[a-z]*>)|(<meal_score\s+score="([^"]*)"(?:\s+reason="([^"]*)")?\s*\/>)/gi;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // It's a <nutr> tag
      const type = match[2];
      const content = match[3];

      let config = (nutrientColors as any)[type] || nutrientColors.default;

      // Safeguard: if the AI uses a generic type but the content is a macro-nutrient, use the correct color
      if (type === "marker" || type === "default") {
        const lower = content.toLowerCase();
        if (lower.includes("белок") || lower.includes("белк")) config = nutrientColors.protein;
        else if (lower.includes("жир")) config = nutrientColors.fat;
        else if (lower.includes("углевод")) config = nutrientColors.carbs;
        else if (lower.includes("калори") || lower.includes("ккал")) config = nutrientColors.calories;
      }

      const colorClass = config.text;

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
}: ChatMessageProps) {
  const isUser = variant === "user";

  if (!isUser) {
    const parsed = detectAndParseFoodLog(text, time);
    if (parsed) {
      console.log("[ChatMessage] CardProps:", parsed.cardProps);
      return (
        <div className="flex flex-col gap-2 w-full">
           {parsed.comment && (
               <div className="flex justify-start">
                 <div className="max-w-[80%] rounded-2xl px-4 py-2.5 rounded-bl-md bg-white text-ink border border-border">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{parseNutrientTags(parsed.comment)}</div>
                    <p className="mt-1 text-[10px] text-right text-ink-faint">{time}</p>
                 </div>
               </div>
           )}
           <div className="flex justify-start">
             <FoodCard {...parsed.cardProps} onDelete={onDelete} onEdit={onEdit} />
           </div>
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
            : "rounded-bl-md bg-white text-ink border border-border"
          }
        `}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{parseNutrientTags(text)}</div>
        <p
          className={`
            mt-1 text-[10px] text-right
            ${isUser ? "text-primary-200" : "text-ink-faint"}
          `}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
