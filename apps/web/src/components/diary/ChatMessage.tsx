import React from "react";
import { MealScoreBadge } from "./MealScoreBadge";
import FoodCard from "./FoodCard";

type ChatMessageProps = {
  /** "user" for right-aligned, "system" for left-aligned. */
  variant: "user" | "system";
  /** Message text content. */
  text: string;
  /** Formatted timestamp string. */
  time: string;
};

function detectAndParseFoodLog(text: string, time: string) {
  try {
    const macroRegex = /Записал\s+([\d.,]+)\s*[гg]\s+([^:]+):\s*([\d.,]+)\s*ккал(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*белк[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*жир[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*уг[а-я]*/i;
    
    const macroMatch = text.match(macroRegex);
    if (!macroMatch) return null;

    const [, weightStr, rawName, calStr, protStr, fatStr, carbStr] = macroMatch;
    
    const weight = parseFloat(weightStr.replace(',', '.'));
    const name = rawName.trim();
    const calories = parseFloat(calStr.replace(',', '.'));
    const protein = parseFloat(protStr.replace(',', '.'));
    const fat = parseFloat(fatStr.replace(',', '.'));
    const carbs = parseFloat(carbStr.replace(',', '.'));

    let score = 0;
    let scoreReason = undefined;
    const scoreMatch = /<meal_score\s+score="([^"]+)"(?:\s+reason="([^"]*)")?\s*\/>/i.exec(text);
    if (scoreMatch) {
       score = parseInt(scoreMatch[1], 10) || 0;
       scoreReason = scoreMatch[2];
    }

    const micros: {name: string, value: string, type: string}[] = [];
    const nutrRegex = /<nutr\s+type="([^"]+)">([^<]+)<\/nutr>/gi;
    let match;
    while ((match = nutrRegex.exec(text)) !== null) {
      const type = match[1];
      const content = match[2]; 
      
      const valueMatch = content.match(/([\d.,]+[A-Za-zА-Яа-я]+)[\s)]*$/);
      let microName = content;
      let microValue = "";
      
      if (valueMatch) {
         microValue = valueMatch[1];
         microName = content.replace(valueMatch[0], '').replace(/[():]/g, '').trim();
      } else {
         microName = content.replace(/[():]/g, '').trim();
      }

      micros.push({ name: microName, value: microValue, type });
    }

    let comment = text
      .replace(macroRegex, '')
      .replace(/<meal_score[^>]*\/>/gi, '')
      .replace(/<nutr[^>]*>.*?<\/nutr>/gi, '')
      .trim();
    
    comment = comment.replace(/^[\s,.]+/, '').replace(/[\s,.]+$/, '').trim();

    return {
      cardProps: { name, emoji: "", weight, calories, protein, fat, carbs, score, scoreReason, micros, time },
      comment
    };

  } catch (e) {
    console.error("Failed to parse food log:", e);
    return null;
  }
}

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

  if (!isUser) {
    const parsed = detectAndParseFoodLog(text, time);
    if (parsed) {
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
             <FoodCard {...parsed.cardProps} />
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
