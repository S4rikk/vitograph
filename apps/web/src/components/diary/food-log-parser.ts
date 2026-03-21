export const macroRegex = /Записал\s+([\d.,]+)\s*[гg]\s+([^:]+):\s*([\d.,]+)\s*ккал(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*белк[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*жир[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*уг[а-я]*/i;

export interface ParsedFoodLog {
  cardProps: {
    name: string;
    emoji: string;
    weight: number;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    score: number;
    scoreReason?: string;
    micros: { name: string; value: string; type: string }[];
    time: string;
  };
  comment: string;
}

export function detectAndParseFoodLog(text: string, time: string): ParsedFoodLog | null {
  try {
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
    const nutrRegex = /<nut[a-z]*\s+[^>]*type=["']([^"']*)["'][^>]*>([\s\S]*?)<\/nut[a-z]*>/gi;
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
      // 1. Remove ALL micro tags (technical data for the card)
      .replace(/<nut[a-z]*\s+[^>]*type=["']micro["'][^>]*>.*?<\/nut[a-z]*>/gi, '')
      // 2. Remove other tags ONLY if they contain Digit + Unit (e.g., "5мг", "10г"). 
      // This preserves "Омега-3" because "3" is not followed by a unit.
      .replace(/<nut[a-z]*[^>]*>[^<]*\d+\s*(?:г|g|ккал|мг|mg|мкг|mcg|ед|u)[^<]*<\/nut[a-z]*>/gi, '')
      .trim();
    
    comment = comment.replace(/^[\s,.]+/, '').replace(/[\s,.]+$/, '').trim();

    return {
      cardProps: { name, emoji: "", weight, calories, protein, fat, carbs, score, scoreReason, micros: micros.filter(m => m.type === 'micro' || (m.value && m.value.length > 0)), time },
      comment
    };

  } catch (e) {
    console.error("Failed to parse food log:", e);
    return null;
  }
}
