/**
 * Centralized nutrient color configuration for Vitograph.
 * Ensures consistency between FoodCard (Macros/Micros) and ChatHighlights.
 */

export const nutrientColors = {
  // Macros
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

  // Micros & Markers
  iron: { 
    text: "text-red-600 font-semibold", 
    dot: "bg-red-500" 
  },
  calcium: { 
    text: "text-yellow-600 font-semibold", 
    dot: "bg-yellow-500" 
  },
  magnesium: { 
    text: "text-emerald-600 font-semibold", 
    dot: "bg-emerald-500" 
  },
  greens: { 
    text: "text-emerald-600 font-semibold", 
    dot: "bg-emerald-500" 
  },
  omega: { 
    text: "text-cyan-600 font-semibold", 
    dot: "bg-cyan-500" 
  },
  vitamin_b: { 
    text: "text-purple-600 font-semibold", 
    dot: "bg-purple-600" 
  },
  vitamin_c: { 
    text: "text-rose-600 font-semibold", 
    dot: "bg-rose-500" 
  },
  vitamin_d: { 
    text: "text-yellow-600 font-semibold", 
    dot: "bg-yellow-500" 
  },
  
  // Default fallback
  default: { 
    text: "text-teal-600 font-semibold", 
    dot: "bg-teal-500" 
  }
} as const;

export type NutrientType = keyof typeof nutrientColors;
