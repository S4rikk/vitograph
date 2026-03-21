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
