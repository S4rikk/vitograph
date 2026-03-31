/**
 * Centralized nutrient color configuration for Vitograph.
 * Ensures consistency between FoodCard (Macros/Micros) and ChatHighlights.
 */

export const nutrientColors = {
  // Macros (keeping bg classes as they work well for boxes)
  calories: {
    text: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    label: "text-orange-700"
  },
  protein: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    label: "text-blue-700"
  },
  fat: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    label: "text-amber-700"
  },
  carbs: {
    text: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
    label: "text-green-700"
  },

  // Micros & Markers (Added HEX for dots)
  iron: { 
    text: "text-red-600 font-semibold", 
    dot: "bg-red-500",
    hex: "#EF4444" 
  },
  calcium: { 
    text: "text-yellow-600 font-semibold", 
    dot: "bg-yellow-500",
    hex: "#EAB308"
  },
  magnesium: { 
    text: "text-emerald-600 font-semibold", 
    dot: "bg-emerald-500",
    hex: "#10B981"
  },
  greens: { 
    text: "text-emerald-600 font-semibold", 
    dot: "bg-emerald-500",
    hex: "#10B981"
  },
  omega: { 
    text: "text-cyan-600 font-semibold", 
    dot: "bg-cyan-500",
    hex: "#06B6D4"
  },
  vitamin_b: { 
    text: "text-purple-600 font-semibold", 
    dot: "bg-purple-600",
    hex: "#9333EA"
  },
  vitamin_c: { 
    text: "text-rose-600 font-semibold", 
    dot: "bg-rose-500",
    hex: "#F43F5E"
  },
  vitamin_d: { 
    text: "text-yellow-600 font-semibold", 
    dot: "bg-yellow-500",
    hex: "#EAB308"
  },
  
  // Default fallback
  default: { 
    text: "text-teal-600 font-semibold", 
    dot: "bg-teal-500",
    hex: "#14B8A6"
  }
} as const;

export type NutrientType = keyof typeof nutrientColors;

const FALLBACK_PALETTE = [
  { text: "text-indigo-600 font-semibold", dot: "bg-indigo-500", hex: "#6366F1" },
  { text: "text-sky-600 font-semibold", dot: "bg-sky-500", hex: "#0EA5E9" },
  { text: "text-violet-600 font-semibold", dot: "bg-violet-500", hex: "#8B5CF6" },
  { text: "text-lime-600 font-semibold", dot: "bg-lime-500", hex: "#84CC16" },
  { text: "text-fuchsia-600 font-semibold", dot: "bg-fuchsia-500", hex: "#D946EF" },
  { text: "text-amber-600 font-semibold", dot: "bg-amber-500", hex: "#F59E0B" },
  { text: "text-pink-600 font-semibold", dot: "bg-pink-500", hex: "#EC4899" },
  { text: "text-cyan-600 font-semibold", dot: "bg-cyan-500", hex: "#06B6D4" },
  { text: "text-rose-600 font-semibold", dot: "bg-rose-500", hex: "#F43F5E" },
  { text: "text-emerald-600 font-semibold", dot: "bg-emerald-500", hex: "#10B981" },
  { text: "text-yellow-600 font-semibold", dot: "bg-yellow-500", hex: "#EAB308" },
  { text: "text-slate-600 font-semibold", dot: "bg-slate-500", hex: "#64748B" },
];

export function getMicronutrientColor(name: string) {
  if (!name) return nutrientColors.default;

  const n = name.toLowerCase().replace(/[\s-]/g, "");

  // Жирорастворимые витамины
  if (n.includes('витамина') || n.includes('vitamina') || n.includes('vitaminа')) {
    return { text: "text-orange-700 font-semibold", dot: "bg-orange-600", hex: "#EA580C" };
  }
  if (n.includes('витаминд') || n.includes('vitamind') || n.includes('витаминd') || n.includes('d3')) {
    return { text: "text-yellow-500 font-semibold", dot: "bg-yellow-400", hex: "#FACC15" };
  }
  if (n.includes('витамине') || n.includes('vitamine') || n.includes('витаминe')) {
    return { text: "text-lime-600 font-semibold", dot: "bg-lime-500", hex: "#84CC16" };
  }
  if (n.includes('витаминк') || n.includes('vitamink') || n.includes('витаминk')) {
    return { text: "text-emerald-700 font-semibold", dot: "bg-emerald-600", hex: "#059669" };
  }

  // Водорастворимые витамины
  if (n.includes('витаминc') || n.includes('vitaminc') || n.includes('витаминс')) {
    return { text: "text-orange-600 font-semibold", dot: "bg-orange-500", hex: "#F97316" };
  }
  if (n.includes('фолиевая') || n.includes('folic') || n.includes('фолат') || n.includes('b9') || n.includes('в9')) {
    return { text: "text-green-700 font-semibold", dot: "bg-green-500", hex: "#22C55E" };
  }
  if (n.includes('витаминb') || n.includes('vitaminb') || n.includes('витаминв') || n.includes('b12') || n.includes('b6') || n.includes('b1')) {
    return { text: "text-blue-600 font-semibold", dot: "bg-blue-500", hex: "#3B82F6" };
  }

  // Минералы и другие элементы
  if (n.includes('желез') || n.includes('iron')) {
    return { text: "text-red-700 font-semibold", dot: "bg-red-600", hex: "#DC2626" };
  }
  if (n.includes('магн') || n.includes('magne')) {
    return { text: "text-emerald-600 font-semibold", dot: "bg-emerald-500", hex: "#10B981" };
  }
  if (n.includes('кальц') || n.includes('calc')) {
    return { text: "text-slate-500 font-semibold", dot: "bg-slate-400", hex: "#94A3B8" };
  }
  if (n.includes('кали') || n.includes('potass')) {
    return { text: "text-purple-600 font-semibold", dot: "bg-purple-500", hex: "#A855F7" };
  }
  if (n.includes('натрий') || n.includes('sodium')) {
    return { text: "text-sky-600 font-semibold", dot: "bg-sky-500", hex: "#0EA5E9" };
  }
  if (n.includes('цинк') || n.includes('zinc')) {
    return { text: "text-cyan-700 font-semibold", dot: "bg-cyan-600", hex: "#0891B2" };
  }
  if (n.includes('селен') || n.includes('sele')) {
    return { text: "text-indigo-600 font-semibold", dot: "bg-indigo-500", hex: "#6366F1" };
  }
  if (n.includes('йод') || n.includes('iodine')) {
    return { text: "text-violet-700 font-semibold", dot: "bg-violet-600", hex: "#7C3AED" };
  }
  if (n.includes('медь') || n.includes('меди') || n.includes('copper')) {
    return { text: "text-amber-800 font-semibold", dot: "bg-amber-700", hex: "#B45309" };
  }
  if (n.includes('фосфор') || n.includes('phosphorus')) {
    return { text: "text-rose-600 font-semibold", dot: "bg-rose-500", hex: "#F43F5E" };
  }
  if (n.includes('омега') || n.includes('omega') || n.includes('epa') || n.includes('dha')) {
    return { text: "text-cyan-700 font-semibold", dot: "bg-cyan-600", hex: "#0891B2" };
  }

  // Fallback map using hash
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = n.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  const colorIndex = hash % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[colorIndex];
}
