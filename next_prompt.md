# TECHNICAL TASK: Deterministic KBJU Macro Calculation

## Context
When a user updates their profile (e.g., activity level, weight), the Python backend successfully drops the `active_nutrition_targets` cache. However, the Express API (`handleGetNutritionTargets`) incorrectly responds by falling back to a static $2000$ kcal preset because the AI generator (`runNutritionAnalyzer`) is never invoked. Wait times for LLM-based basal metabolic rate calculation are unacceptable ($5+$ seconds) and LLMs are notoriously bad at math.

## Architectural Decision
We are completely deprecating the use of the LLM for macronutrient targets. Like we did for `computeDeterministicMicros`, you will implement a rigid, instant mathematical calculation for macros using the standard Mifflin-St Jeor equation inside `ai.controller.ts`. 

## Required Changes

### 1. `apps/api/src/ai/src/ai.controller.ts`

**A. Create `computeDeterministicMacros`**
Implement this standalone function near `computeDeterministicMicros`:
```ts
function computeDeterministicMacros(profile: any): { calories: number; protein: number; fat: number; carbs: number; } {
  // 1. Fallback base
  const base = { calories: 2000, protein: 120, fat: 60, carbs: 250 };
  if (!profile || !profile.weight_kg || !profile.height_cm || !profile.date_of_birth) return base;

  // 2. Parse basic metrics
  const weight = profile.weight_kg;
  const height = profile.height_cm;
  const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();
  const isFemale = profile.biological_sex === 'female';

  // 3. Mifflin-St Jeor BMR
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = isFemale ? (bmr - 161) : (bmr + 5);

  // 4. Activity Multiplier (TDEE)
  const activityMap: Record<string, number> = {
    'sedentary': 1.2,
    'light_active': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
  };
  const multiplier = activityMap[profile.activity_level] || 1.2;
  
  let tdee = Math.round(bmr * multiplier);

  // 5. Diet Goal / Type modifier (Optional basic modifiers, default is maintenance)
  // Example: if profile has a goal, we could add/subtract. For now, maintenance:
  
  // 6. Macro Split
  // Protein: ~1.8g per kg
  const protein = Math.round(weight * 1.8);
  // Fat: ~1.0g per kg
  const fat = Math.round(weight * 1.0);
  
  // Carbs: The rest of the calories
  // (Protein=4kcal/g, Fat=9kcal/g, Carbs=4kcal/g)
  const remainingCalories = tdee - (protein * 4) - (fat * 9);
  const carbs = Math.max(0, Math.round(remainingCalories / 4));

  return {
    calories: tdee,
    protein,
    fat,
    carbs
  };
}
```

**B. Update `handleGetNutritionTargets`**
Delete the rigid $2000$ fallback completely and replace it with:
```ts
    // Macro deterministic compute
    const macros = computeDeterministicMacros(profile);

    // Micro deterministic compute
    const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases);
```

**C. Update `formatNutritionTargets` system prompt builder**
In `formatNutritionTargets`, you must also replace the `profile?.active_nutrition_targets?.macros` check with `computeDeterministicMacros(profile)` so that the AI Assistant's context window gets the EXACT same dynamic KBJU targets as the UI!
```ts
function formatNutritionTargets(profile: any, activeKnowledgeBases: any[] | null): string {
  const { micros, rationale } = computeDeterministicMicros(profile, activeKnowledgeBases);
  const macros = computeDeterministicMacros(profile);

  let text = `${rationale}\n`;
  text += `Макросы: Ккал=${macros.calories}, Белки=${macros.protein}г, Жиры=${macros.fat}г, Углеводы=${macros.carbs}г\n`;
  ...
```

### 2. Verify Output
Run `npm run build` in `apps/api` to ensure TypeScript compiles successfully without errors.

## Strict Rules
- Do NOT alter `computeDeterministicMicros`.
- Make sure to cover the case where `profile` fields (like `weight_kg`) are missing by securely falling back to $2000$ kcal.

**SKILLS TO APPLY:** `senior-architect`, `code-reviewer`
