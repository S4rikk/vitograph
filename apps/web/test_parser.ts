import fs from 'fs';
import path from 'path';

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

const inputs = [
  'Записал 20г мёда: 61 ккал, 0.1г белка, 0г жира, 17г уг. <nutr type="vitamin_c">Витамин C (10мг)</nutr> <meal_score score="40" reason="Оценка" />',
  'Отличный выбор! Записал 150.5 g Куриная грудка: 250 ккал, 30.2г белков  5,5 г жиров, 0 г углеводов',
  'Просто какой-то диалог бота без логов макросов.',
  'Записал 100г Морковь: 41 ккал, 0.9г белка, 0.2г жира, 9.6г уг. <nutr type="vitamin_a">Витамин А: 835мкг</nutr> <meal_score score="95" reason="Очень полезно для глаз" /> Не забудьте съесть с маслом для усвоения!'
];

inputs.forEach((input, i) => {
  console.log(`\n--- Test ${i + 1} ---`);
  console.log("Input:", input);
  const result = detectAndParseFoodLog(input, "12:00");
  console.log("Parsed:", JSON.stringify(result, null, 2));
});
