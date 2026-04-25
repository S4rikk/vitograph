/**
 * GI-Based Micronutrient Bioavailability Coefficients
 * 
 * Adjusts raw micronutrient values based on the Glycemic Index of the food.
 * High-GI foods dramatically reduce absorption of B-vitamins, minerals, etc.
 * 
 * Applied at write-time (before saving to meal_logs.micronutrients).
 */

// ── Types ──

interface GiCoefficientGroup {
  groupName: string;
  nutrients: string[];
  coefficients: [number, number, number, number, number, number, number]; // 7 ranges
}

// ── Data ──

const GI_COEFFICIENT_GROUPS: GiCoefficientGroup[] = [
  {
    groupName: "Расходники",
    nutrients: ["Магний", "Витамин B1", "Витамин B2", "Витамин B3", "Витамин B5", "Витамин B6"],
    coefficients: [1.0, 0.90, 0.75, 0.50, 0.30, 0.15, 0.05],
  },
  {
    groupName: "Конкуренты",
    nutrients: ["Витамин C", "Калий", "Цинк", "Кальций"],
    coefficients: [1.0, 0.95, 0.85, 0.70, 0.50, 0.35, 0.20],
  },
  {
    groupName: "Нейтральные",
    nutrients: ["Витамин A", "Витамин E", "Витамин D", "Витамин B12", "Селен", "Медь"],
    coefficients: [1.0, 1.0, 0.95, 0.90, 0.85, 0.75, 0.60],
  },
  {
    groupName: "Условно-зависимые",
    nutrients: ["Железо", "Хром", "Йод"],
    coefficients: [1.0, 0.95, 0.90, 0.80, 0.65, 0.50, 0.30],
  },
];

// Upper bounds (inclusive) for 7 GI ranges: [0-15], (15-30], (30-45], (45-60], (60-80], (80-100], (100+)
const GI_RANGE_UPPER_BOUNDS = [15, 30, 45, 60, 80, 100];

// ── Build a lookup map for O(1) access ──

const NUTRIENT_TO_GROUP_INDEX: Map<string, number> = new Map();
GI_COEFFICIENT_GROUPS.forEach((group, groupIdx) => {
  group.nutrients.forEach((nutrient) => {
    NUTRIENT_TO_GROUP_INDEX.set(nutrient, groupIdx);
  });
});

/**
 * Applies GI-based bioavailability coefficients to raw micronutrient values.
 * 
 * @param rawMicros - Raw micronutrient map, e.g. {"Магний (мг)": 16, "Калий (мг)": 190}
 * @param glycemicIndex - GI of the food (0-100+), or null/undefined if unknown
 * @returns Object with adjusted micros and the GI that was applied (or null)
 */
export function applyGiBioavailability(
  rawMicros: Record<string, number>,
  glycemicIndex: number | null | undefined
): { adjusted: Record<string, number>; appliedGi: number | null } {
  // If GI is unknown or zero, return raw values unchanged
  if (glycemicIndex == null || glycemicIndex <= 0) {
    return { adjusted: { ...rawMicros }, appliedGi: null };
  }

  let rangeIndex = GI_RANGE_UPPER_BOUNDS.length; // default: last range (>100)
  for (let i = 0; i < GI_RANGE_UPPER_BOUNDS.length; i++) {
    if (glycemicIndex <= GI_RANGE_UPPER_BOUNDS[i]) {
      rangeIndex = i;
      break;
    }
  }

  const adjusted: Record<string, number> = {};

  for (const [key, value] of Object.entries(rawMicros)) {
    if (typeof value !== "number" || value <= 0) {
      adjusted[key] = value;
      continue;
    }

    // Normalize: "Магний (мг)" → "Магний", "Витамин C (мг)" → "Витамин C"
    const normalizedName = key.split(" (")[0].trim();

    const groupIdx = NUTRIENT_TO_GROUP_INDEX.get(normalizedName);
    if (groupIdx !== undefined) {
      const coefficient = GI_COEFFICIENT_GROUPS[groupIdx].coefficients[rangeIndex];
      adjusted[key] = Number((value * coefficient).toFixed(1));
    } else {
      // Unknown nutrient → no adjustment (Kb = 1.0)
      adjusted[key] = value;
    }
  }

  return { adjusted, appliedGi: glycemicIndex };
}
