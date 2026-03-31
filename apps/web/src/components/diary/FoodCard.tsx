import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { nutrientColors, getMicronutrientColor } from "@/lib/food-diary/nutrient-colors";

interface FoodCardProps {
  name: string;        // "мёда" (или "Мёд", как вытащишь)
  emoji: string;       // "🍽️" (хардкод или простая генерация, бэкенд не присылает эмодзи)
  weight: number;      // 20
  calories: number;    // 61
  protein: number;     // 0.1
  fat: number;         // 0
  carbs: number;       // 17
  score: number;       // 40
  scoreReason?: string; // "Оценка" (опционально, для тултипа или логов)
  micros?: { name: string; value: string; type: string }[]; // Парсится из <nutr>
  time: string;        // "14:54"
  mealId?: string;     // UUID из БД
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function getEmojiForFood(foodName: string): string {
    const lower = foodName.toLowerCase();
    
    // Мясо и птица
    if (lower.includes('говяд') || lower.includes('телят') || lower.includes('стейк')) return '🥩';
    if (lower.includes('кури') || lower.includes('индей') || lower.includes('птиц') || lower.includes('грудк')) return '🍗';
    if (lower.includes('свин') || lower.includes('бекон') || lower.includes('колбас') || lower.includes('сосис') || lower.includes('ветчин')) return '🥓';
    if (lower.includes('мяс') || lower.includes('котлет') || lower.includes('фарш')) return '🍖';
    if (lower.includes('бургер') || lower.includes('гамб')) return '🍔';
    
    // Рыба и морепродукты
    if (lower.includes('рыб') || lower.includes('лосо') || lower.includes('форел') || lower.includes('тунец') || lower.includes('сельдь')) return '🐟';
    if (lower.includes('кревет') || lower.includes('краб') || lower.includes('кальм') || lower.includes('море')) return '🦐';
    if (lower.includes('суши') || lower.includes('ролл')) return '🍣';
    
    // Яйца и молочка
    if (lower.includes('яйц') || lower.includes('яич') || lower.includes('омлет') || lower.includes('глазун')) return '🍳';
    if (lower.includes('сыр') || lower.includes('пармезан') || lower.includes('моцарелл')) return '🧀';
    if (lower.includes('молок') || lower.includes('кефир') || lower.includes('йогурт') || lower.includes('сметан') || lower.includes('твор')) return '🥛';
    if (lower.includes('масло сливоч')) return '🧈';

    // Овощи
    if (lower.includes('картоф') || lower.includes('пюре')) return '🥔';
    if (lower.includes('помидор') || lower.includes('томат')) return '🍅';
    if (lower.includes('огурцы') || lower.includes('огурец')) return '🥒';
    if (lower.includes('морков')) return '🥕';
    if (lower.includes('брокколи') || lower.includes('капуст')) return '🥦';
    if (lower.includes('лук') || lower.includes('чеснок')) return '🧅';
    if (lower.includes('зелен') || lower.includes('салат') || lower.includes('шпинат') || lower.includes('руккол')) return '🥬';
    if (lower.includes('овощ') || lower.includes('веган')) return '🥗';
    if (lower.includes('авокадо')) return '🥑';
    
    // Фрукты и ягоды
    if (lower.includes('яблок')) return '🍎';
    if (lower.includes('бан')) return '🍌';
    if (lower.includes('апел') || lower.includes('мандар') || lower.includes('цитрус')) return '🍊';
    if (lower.includes('лимон')) return '🍋';
    if (lower.includes('ягод') || lower.includes('клубник') || lower.includes('малин') || lower.includes('черник') || lower.includes('вишн')) return '🍓';
    if (lower.includes('виногр')) return '🍇';
    if (lower.includes('фрукт')) return '🍑';
    
    // Гарниры, крупы, макароны
    if (lower.includes('рис') || lower.includes('плов')) return '🍚';
    if (lower.includes('макарон') || lower.includes('паст') || lower.includes('спагетт')) return '🍝';
    if (lower.includes('гречк') || lower.includes('овсян') || lower.includes('каш') || lower.includes('круп') || lower.includes('чечевиц') || lower.includes('нут') || lower.includes('горох')) return '🥣';
    
    // Орехи и хлеб
    if (lower.includes('орех') || lower.includes('миндал') || lower.includes('арахис') || lower.includes('кешью')) return '🥜';
    if (lower.includes('хлеб') || lower.includes('булоч') || lower.includes('тост') || lower.includes('бутерб') || lower.includes('батон')) return '🍞';
    if (lower.includes('выпеч') || lower.includes('пирог') || lower.includes('печень') || lower.includes('круассан')) return '🥐';
    if (lower.includes('блин') || lower.includes('олад')) return '🥞';
    if (lower.includes('пицц')) return '🍕';

    // Сладости
    if (lower.includes('мёд') || lower.includes('меда')) return '🍯';
    if (lower.includes('шок') || lower.includes('конфет') || lower.includes('батончик')) return '🍫';
    if (lower.includes('морожен') || lower.includes('пломбир')) return '🍦';
    if (lower.includes('торт') || lower.includes('десерт') || lower.includes('пирожн') || lower.includes('слад')) return '🍰';
    
    // Напитки
    if (lower.includes('коф') || lower.includes('капучин') || lower.includes('латте') || lower.includes('эспрессо')) return '☕';
    if (lower.includes('ча') || lower.includes('матча')) return '🍵';
    if (lower.includes('сок') || lower.includes('фреш') || lower.includes('напит') || lower.includes('лимонад')) return '🧃';
    if (lower.includes('вод') || lower.includes('минерал')) return '💧';
    if (lower.includes('вино')) return '🍷';
    if (lower.includes('пиво')) return '🍺';
    
    // Дефолт
    return '🍽️';
}

function getHealthScoreStyle(score: number) {
    if (score < 40) return "bg-[linear-gradient(135deg,#FEE2E2,#FECACA)] text-[#E74C3C]";
    if (score < 70) return "bg-[linear-gradient(135deg,#FEF3C7,#FDE68A)] text-[#F39C12]";
    return "bg-[linear-gradient(135deg,#D1FAE5,#A7F3D0)] text-[#27AE60]";
}


export default function FoodCard({
  name,
  emoji,
  weight,
  calories,
  protein,
  fat,
  carbs,
  score,
  scoreReason,
  micros,
  time,
  mealId,
  onDelete,
  onEdit,
}: FoodCardProps) {
  const finalEmoji = emoji && emoji !== "🍽️" ? emoji : getEmojiForFood(name);

  return (
    <div className="bg-white border border-border shadow-sm rounded-2xl px-3 pt-3 pb-2 w-full flex flex-col max-w-[320px] sm:max-w-[400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-start gap-2">
            <div className="flex flex-col items-center justify-center shrink-0">
                <span className="text-[24px] leading-none">{finalEmoji}</span>
                <span className="text-[11px] text-ink-muted font-medium whitespace-nowrap mt-0.5">{weight} г</span>
            </div>
            <span className="font-bold text-ink text-[14px] leading-tight line-clamp-2 max-w-[160px] sm:max-w-[220px] pt-0.5" title={name}>
                {name}
            </span>
        </div>
        <div title={scoreReason} className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm mt-0.5 ${getHealthScoreStyle(score)}`}>
            {score}/100
        </div>
      </div>

      {/* Macros */}
      <div className="flex gap-1.5 mb-2 justify-between">
        <div className={`flex-1 flex flex-col items-center ${nutrientColors.calories.bg} border ${nutrientColors.calories.border} rounded-xl py-1 px-0.5`}>
            <span className={`text-[9px] font-semibold ${nutrientColors.calories.text} uppercase tracking-wider`}>ККАЛ</span>
            <span className={`font-bold text-[13px] ${nutrientColors.calories.label} leading-none mt-0.5`}>{calories}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center ${nutrientColors.protein.bg} border ${nutrientColors.protein.border} rounded-xl py-1 px-0.5`}>
            <span className={`text-[9px] font-semibold ${nutrientColors.protein.text} uppercase tracking-wider`}>БЕЛКИ</span>
            <span className={`font-bold text-[13px] ${nutrientColors.protein.label} leading-none mt-0.5`}>{protein}г</span>
        </div>
        <div className={`flex-1 flex flex-col items-center ${nutrientColors.fat.bg} border ${nutrientColors.fat.border} rounded-xl py-1 px-0.5`}>
            <span className={`text-[9px] font-semibold ${nutrientColors.fat.text} uppercase tracking-wider`}>ЖИРЫ</span>
            <span className={`font-bold text-[13px] ${nutrientColors.fat.label} leading-none mt-0.5`}>{fat}г</span>
        </div>
        <div className={`flex-1 flex flex-col items-center ${nutrientColors.carbs.bg} border ${nutrientColors.carbs.border} rounded-xl py-1 px-0.5`}>
            <span className={`text-[9px] font-semibold ${nutrientColors.carbs.text} uppercase tracking-wider`}>УГЛЕВОДЫ</span>
            <span className={`font-bold text-[13px] ${nutrientColors.carbs.label} leading-none mt-0.5`}>{carbs}г</span>
        </div>
      </div>

      {/* Micros */}
      {micros && micros.length > 0 && (
          <div className="mb-1 pt-1.5 border-t border-border/50">
             <div className="text-[9px] text-ink-faint uppercase font-bold tracking-wider mb-1">Микронутриенты</div>
             <div className="flex flex-wrap gap-1">
                 {micros.map((micro, idx) => {
                     const colorSpace = getMicronutrientColor(micro.name);
                     return (
                         <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-subtle border border-border/60 rounded-full text-[11px] leading-tight">
                             <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorSpace.dot}`}></div>
                             <span className={colorSpace.text}>{micro.name} <span className="opacity-60 ml-0.5">{micro.value}</span></span>
                         </div>
                     );
                 })}
             </div>
          </div>
      )}

      {/* Footer */}
      <div className="flex justify-end items-center mt-auto pt-0 gap-2.5">
          {mealId && (
              <div className="flex gap-1.5">
                  <button 
                      onClick={() => onEdit?.(mealId)}
                      className="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 z-[50]"
                      title="Изменить вес"
                  >
                      <Pencil size={16} />
                  </button>
                  <button 
                      onClick={() => onDelete?.(mealId)}
                      className="text-red-500 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 z-[50]"
                      title="Удалить"
                  >
                      <Trash2 size={16} />
                  </button>
              </div>
          )}
          <span className="text-[10px] text-ink-faint">{time}</span>
      </div>
    </div>
  );
}
