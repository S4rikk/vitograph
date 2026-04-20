import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { getMicronutrientColor } from "@/lib/food-diary/nutrient-colors";

interface FoodCardProps {
  name: string;
  emoji: string;
  weight: number;
  // GI fields (new — from parser)
  gi: number | null;
  responseType: "flat" | "moderate" | "spike" | null;
  energyHours: number | null;
  // Legacy (kept for backward compat, NOT displayed)
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  // Existing
  score: number;
  scoreReason?: string;
  micros?: { name: string; value: string; type: string }[];
  time: string;
  mealId?: string;
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
    if (lower.includes('гриб')) return '🍄';
    if (lower.includes('кукуруз')) return '🌽';
    if (lower.includes('перец') || lower.includes('паприк')) return '🫑';
    if (lower.includes('баклажан')) return '🍆';
    
    // Фрукты и ягоды
    if (lower.includes('груш')) return '🍐';
    if (lower.includes('персик') || lower.includes('нектарин')) return '🍑';
    if (lower.includes('арбуз')) return '🍉';
    if (lower.includes('дын')) return '🍈';
    if (lower.includes('кокос')) return '🥥';
    if (lower.includes('черешн')) return '🍒';
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
    
    // Супы
    if (lower.includes('суп') || lower.includes('борщ') || lower.includes('щи') || lower.includes('бульон') || lower.includes('солянк')) return '🍲';
    
    // Напитки
    if (lower.includes('коф') || lower.includes('капучин') || lower.includes('латте') || lower.includes('эспрессо')) return '☕';
    if (lower.includes('чай') || lower.includes('матча')) return '🍵';
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

/** Maps response type to visual badge */
function getResponseBadge(type: string | null) {
  switch (type) {
    case 'flat':
      return { 
        label: 'Плавная волна', 
        icon: (
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12 Q 6 9, 10 12 T 18 12" />
          </svg>
        ), 
        bg: 'bg-[#ECFDF5]', text: 'text-[#059669]', border: 'border-[#A7F3D0]' 
      };
    case 'spike':
      return { 
        label: 'Сахарная игла', 
        icon: (
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12 L 8 4 L 13 10 L 18 11" />
          </svg>
        ), 
        bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' 
      };
    case 'moderate':
    default:
      return { 
        label: 'Умеренный отклик', 
        icon: (
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12 Q 7 5, 12 9 T 18 11" />
          </svg>
        ), 
        bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FDE68A]' 
      };
  }
}

/** Maps GI value to color */
function getGIColor(gi: number | null) {
  if (gi === null) return { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: '?', emoji: '⚪' };
  if (gi <= 55) return { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]', label: 'Низкий', emoji: '🟢' };
  if (gi <= 69) return { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', label: 'Средний', emoji: '🟡' };
  return { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', label: 'Высокий', emoji: '🔴' };
}


export default function FoodCard({
  name,
  emoji,
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

      {/* ── Glycemic Response (3 pills) ── */}
      <div className="flex gap-1.5 mb-2 justify-between">
        {/* GI Value */}
        <div className={`flex-1 flex flex-col items-center justify-center ${getGIColor(gi).bg} border border-border/40 rounded-xl py-1.5 px-1 min-w-0`}>
          <span className={`font-[800] text-[18px] ${getGIColor(gi).text} leading-none mb-1`}>{gi ?? '?'}</span>
          <span className={`text-[9px] ${getGIColor(gi).text} opacity-80 flex items-center gap-0.5`}>
            ГИ <span className="text-[10px] mx-0.5 leading-none">{getGIColor(gi).emoji}</span> {getGIColor(gi).label}
          </span>
        </div>

        {/* Response Type */}
        {responseType && (() => {
          const badge = getResponseBadge(responseType);
          return (
            <div className={`flex-1 flex flex-col items-center justify-center ${badge.bg} border ${badge.border} rounded-xl py-1.5 px-1 min-w-0 text-center`}>
              <div className={`mb-1 ${badge.text}`}>{badge.icon}</div>
              <span className={`text-[9px] font-bold ${badge.text} leading-tight text-center`}>{badge.label}</span>
            </div>
          );
        })()}

        {/* Energy Duration */}
        {energyHours && (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl py-1.5 px-1 min-w-0">
            <span className="font-[800] text-[17px] text-[#2563EB] leading-none mb-1 flex items-baseline justify-center whitespace-nowrap">
              {energyHours}<span className="text-[12px] font-bold ml-[1px]">ч</span>
            </span>
            <span className="text-[9px] text-[#2563EB] opacity-70 whitespace-nowrap">энергии</span>
          </div>
        )}
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
      <div className="flex justify-end items-center mt-auto pt-0 gap-2.5 pr-6 sm:pr-0">
          {mealId && (
              <div className="flex gap-1.5">
                  <button 
                      onClick={() => onEdit?.(mealId)}
                      className="text-blue-500 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50"
                      title="Изменить вес"
                  >
                      <Pencil size={16} />
                  </button>
                  <button 
                      onClick={() => onDelete?.(mealId)}
                      className="text-red-500 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
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
