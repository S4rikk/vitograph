// New GI-oriented format: "Записал [вес]г [название] | GI:[число] | [response] | [часы]ч энергии"
export const glycemicRegex = /Записал\s+([\d.,]+)\s*[гg]\s+(.+?)\s*\|\s*GI:\s*([\d.,]+)\s*\|\s*(flat|moderate|spike)\s*\|\s*([\d.,]+)\s*ч\s*энер/i;

// Legacy fallback: old КБЖУ format (for historical messages still in DB)
export const legacyMacroRegex = /Записал\s+([\d.,]+)\s*[гg]\s+([^:]+):\s*([\d.,]+)\s*ккал(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*белк[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*жир[а-я]*(?:,\s*|\s+)([\d.,]+)\s*[гg]\s*уг[а-я]*/i;

export interface ParsedFoodLog {
  cardProps: {
    name: string;
    emoji: string;
    weight: number;
    // GI fields (new)
    gi: number | null;
    responseType: "flat" | "moderate" | "spike" | null;
    energyHours: number | null;
    // Legacy macro fields (kept for backward compatibility with historical messages)
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    // Existing
    score: number;
    scoreReason?: string;
    micros: { name: string; value: string; type: string }[];
    time: string;
    mealId?: string;
  };
  comment: string;
}

export function detectAndParseFoodLog(text: string, time: string, mealData?: any): ParsedFoodLog | null {
  console.log("[Parser] Full Text:", text);
  try {
    // Try new GI format first
    const giMatch = text.match(glycemicRegex);
    // Fallback to legacy КБЖУ format (for old messages in chat history)
    const legacyMatch = !giMatch ? text.match(legacyMacroRegex) : null;
    const mealIdMatch = /<meal_id\s+id="([^"]+)"\s*\/>/i.exec(text);

    if (!giMatch && !legacyMatch && !mealIdMatch) return null;

    let weight = 0, name = "Запись из красной зоны";
    let gi: number | null = null, responseType: "flat" | "moderate" | "spike" | null = null, energyHours: number | null = null;
    let calories = 0, protein = 0, fat = 0, carbs = 0;

    if (giMatch) {
      // New GI format
      weight = parseFloat(giMatch[1].replace(',', '.'));
      name = giMatch[2].trim();
      gi = parseFloat(giMatch[3].replace(',', '.'));
      responseType = giMatch[4] as "flat" | "moderate" | "spike";
      energyHours = parseFloat(giMatch[5].replace(',', '.'));
    } else if (legacyMatch) {
      // Legacy КБЖУ format
      const [, weightStr, rawName, calStr, protStr, fatStr, carbStr] = legacyMatch;
      weight = parseFloat(weightStr.replace(',', '.'));
      name = rawName.trim();
      calories = parseFloat(calStr.replace(',', '.'));
      protein = parseFloat(protStr.replace(',', '.'));
      fat = parseFloat(fatStr.replace(',', '.'));
      carbs = parseFloat(carbStr.replace(',', '.'));
    } else if (mealIdMatch && mealData) {
      // Fallback: extract data from DB meal_items provided by backend
      const dataItem = Array.isArray(mealData) ? mealData[0] : mealData;
      if (dataItem) {
        weight = dataItem.weight_g || 0;
        name = dataItem.food_name || "Запись из красной зоны";
        gi = dataItem.glycemic_index || null;
        responseType = dataItem.response_type || null;
        energyHours = dataItem.energy_duration_hours || null;
        calories = dataItem.calories || 0;
        protein = dataItem.protein_g || 0;
        fat = dataItem.fat_g || 0;
        carbs = dataItem.carbs_g || 0;
      }
    }

    // Parse mealId (unchanged)
    let mealId = undefined;
    if (mealIdMatch) mealId = mealIdMatch[1];
    console.log("[Parser] Found mealId:", mealId);

    // Parse score (unchanged)
    let score = 0;
    let scoreReason = undefined;
    const scoreMatch = /<meal_score\s+score="([^"]+)"(?:\s+reason="([\s\S]*?)")?\s*\/>/i.exec(text);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1], 10) || 0;
      scoreReason = scoreMatch[2];
    }

    // Parse micros (unchanged)
    const micros: { name: string; value: string; type: string }[] = [];
    const nutrRegex = /<nut[a-z]*\s+[^>]*type[a-z]*=["']([^"']*)["'][^>]*>([\s\S]*?)<\/nut[a-z]*>/gi;
    let match;
    while ((match = nutrRegex.exec(text)) !== null) {
      const type = match[1];
      const content = match[2];

      const valueMatch = content.match(/([\d.,]+\s*[%A-Za-zА-Яа-я]+)[\s)]*$/);
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

    // Build clean comment
    let comment = text;
    if (giMatch) {
      comment = comment.replace(glycemicRegex, '');
    } else if (legacyMatch) {
      comment = comment.replace(legacyMacroRegex, '');
    }
    
    comment = comment
      .replace(/<meal_score\s+[\s\S]*?\/>/gi, '')
      .replace(/<meal_id[^>]*\/>/gi, '')
      .replace(/<nut[a-z]*\s+[^>]*type[a-z]*=["']micro["'][^>]*>[\s\S]*?<\/nut[a-z]*>/gi, '')
      .trim();

    comment = comment.replace(/^[\s,.]+/, '').replace(/[\s,.]+$/, '').trim();

    return {
      cardProps: {
        name,
        emoji: "",
        weight,
        gi,
        responseType,
        energyHours,
        calories,
        protein,
        fat,
        carbs,
        score,
        scoreReason,
        micros: micros.filter(m => m.type === 'micro' || (m.value && m.value.length > 0)),
        time,
        mealId,
      },
      comment,
    };
  } catch (e) {
    console.error("Failed to parse food log:", e);
    return null;
  }
}
