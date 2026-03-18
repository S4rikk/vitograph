import React from "react";

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
}

export function getEmojiForFood(foodName: string): string {
    const lower = foodName.toLowerCase();
    if (lower.includes('мяс') || lower.includes('кури') || lower.includes('говяд') || lower.includes('свин')) return '🍖';
    if (lower.includes('мёд') || lower.includes('слад') || lower.includes('сахар') || lower.includes('шок')) return '🍫';
    if (lower.includes('вод') || lower.includes('напит') || lower.includes('ча') || lower.includes('коф')) return '🥤';
    if (lower.includes('яблок') || lower.includes('фрукт') || lower.includes('бан') || lower.includes('апел')) return '🍎';
    if (lower.includes('рыб') || lower.includes('лосо') || lower.includes('море')) return '🐟';
    if (lower.includes('овощ') || lower.includes('огур') || lower.includes('поми') || lower.includes('морк')) return '🥕';
    if (lower.includes('яйц') || lower.includes('яич')) return '🥚';
    if (lower.includes('сыр') || lower.includes('молок') || lower.includes('твор')) return '🧀';
    if (lower.includes('хлеб') || lower.includes('выпеч') || lower.includes('було')) return '🍞';
    return '🍽️';
}

function getHealthScoreStyle(score: number) {
    if (score < 40) return "bg-[linear-gradient(135deg,#FEE2E2,#FECACA)] text-[#E74C3C]";
    if (score < 70) return "bg-[linear-gradient(135deg,#FEF3C7,#FDE68A)] text-[#F39C12]";
    return "bg-[linear-gradient(135deg,#D1FAE5,#A7F3D0)] text-[#27AE60]";
}

function getMicroColorClass(type: string): string {
  // Return the color for the dot
  if (type === "iron") return "bg-red-500";
  if (type === "magnesium" || type === "greens") return "bg-green-500";
  if (type === "vitamin_c") return "bg-orange-500";
  if (type === "calcium" || type === "vitamin_d") return "bg-amber-500";
  if (type === "omega") return "bg-blue-500";
  if (type === "vitamin_b") return "bg-purple-500";
  return "bg-teal-500";
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
}: FoodCardProps) {
  const finalEmoji = emoji && emoji !== "🍽️" ? emoji : getEmojiForFood(name);

  return (
    <div className="bg-white border border-border shadow-sm rounded-2xl p-4 w-full flex flex-col max-w-[320px] sm:max-w-[400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{finalEmoji}</span>
            <div className="flex flex-col">
                <span className="font-bold text-ink text-base leading-tight truncate max-w-[150px] sm:max-w-[200px]" title={name}>
                    {name}
                </span>
                <span className="text-xs text-ink-muted">{weight} г</span>
            </div>
        </div>
        <div title={scoreReason} className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${getHealthScoreStyle(score)}`}>
            {score}/100
        </div>
      </div>

      {/* Macros */}
      <div className="flex gap-2 mb-4 justify-between">
        <div className="flex-1 flex flex-col items-center bg-orange-50 border border-orange-100 rounded-xl py-1.5 px-1">
            <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-0.5">ККАЛ</span>
            <span className="font-bold text-orange-700 leading-none">{calories}</span>
        </div>
        <div className="flex-1 flex flex-col items-center bg-blue-50 border border-blue-100 rounded-xl py-1.5 px-1">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">БЕЛКИ</span>
            <span className="font-bold text-blue-700 leading-none">{protein}г</span>
        </div>
        <div className="flex-1 flex flex-col items-center bg-amber-50 border border-amber-100 rounded-xl py-1.5 px-1">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">ЖИРЫ</span>
            <span className="font-bold text-amber-700 leading-none">{fat}г</span>
        </div>
        <div className="flex-1 flex flex-col items-center bg-green-50 border border-green-100 rounded-xl py-1.5 px-1">
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-0.5">УГЛЕВ</span>
            <span className="font-bold text-green-700 leading-none">{carbs}г</span>
        </div>
      </div>

      {/* Micros */}
      {micros && micros.length > 0 && (
          <div className="mb-3 pt-3 border-t border-border/50">
             <div className="text-[10px] text-ink-faint uppercase font-bold tracking-wider mb-2">Микронутриенты</div>
             <div className="flex flex-wrap gap-1.5">
                 {micros.map((micro, idx) => (
                     <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-surface-subtle border border-border rounded-full text-xs text-ink-muted">
                         <div className={`w-1.5 h-1.5 rounded-full ${getMicroColorClass(micro.type)}`}></div>
                         <span className="font-medium">{micro.name} <span className="opacity-60">{micro.value}</span></span>
                     </div>
                 ))}
             </div>
          </div>
      )}

      {/* Footer */}
      <div className="flex justify-end mt-auto pt-1">
          <span className="text-[10px] text-ink-faint">{time}</span>
      </div>
    </div>
  );
}
