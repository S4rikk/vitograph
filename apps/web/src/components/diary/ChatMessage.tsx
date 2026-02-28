import React from "react";
import { MealScoreBadge } from "./MealScoreBadge";

type ChatMessageProps = {
  /** "user" for right-aligned, "system" for left-aligned. */
  variant: "user" | "system";
  /** Message text content. */
  text: string;
  /** Formatted timestamp string. */
  time: string;
};

function parseNutrientTags(text: string) {
  if (!text) return text;

  const combinedRegex = /(<nutr\s+type="([^"]*)">([^<]*)<\/nutr>)|(<meal_score\s+score="([^"]*)"(?:\s+reason="([^"]*)")?\s*\/>)/g;
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

      let colorClass = "text-teal-600 font-semibold";
      if (type === "iron") colorClass = "text-red-600 font-semibold";
      else if (type === "magnesium" || type === "greens") colorClass = "text-green-600 font-semibold";
      else if (type === "vitamin_c") colorClass = "text-orange-600 font-semibold";
      else if (type === "calcium" || type === "vitamin_d") colorClass = "text-amber-600 font-semibold";
      else if (type === "omega") colorClass = "text-blue-600 font-semibold";
      else if (type === "vitamin_b") colorClass = "text-purple-600 font-semibold";

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
}: ChatMessageProps) {
  const isUser = variant === "user";

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
