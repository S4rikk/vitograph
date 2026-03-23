# VITOGRAPH: TECHNICAL TASK (Phase 56 v8 - ATOMIC MACRO SYNC)
# Objectives: Fix Double-Scaling Bug + Atomic Sync

## 1. Context: The "Double-Scaling" Bug
In v7, when updating weight (e.g., 40g -> 80g), the code used a global regex that:
1. Replaced "0г" (protein) with "80г" (new total weight).
2. Then multiplied that "80г" by the ratio (2), resulting in "160г".
This is WRONG. Honey should not have 160g of protein.

## 2. Technical Task - BACKEND (`ai.controller.ts`)

### 2.1 handleUpdateMealLog (Sync Logic)
**STOP using `.replace()` with multipliers on existing numbers.**
Instead, use **Atomic Reconstruction**:

1. **Get New Totals**: You already have `updatedMacros` (calories, protein, fat, carbs) and `updatedMicros`.
2. **Rebuild the String**: Construct the exact "Записал..." line:
   ```ts
   const newMacroLine = `Записал ${Math.round(new_weight_g)}г ${log.meal_items[0].food_name}: ${Math.round(updatedMacros.total_calories)} ккал, ${updatedMacros.total_protein.toFixed(1)}г белков, ${updatedMacros.total_fat.toFixed(1)}г жиров, ${updatedMacros.total_carbs.toFixed(1)}г углеводов`;
   ```
3. **Replace the Block**:
   - Use one regex to find the ENTIRE block from "Записал" to "углеводов" and replace it with `newMacroLine`.
   - **Micros**: Similarly, rebuild the micronutrient tags from scratch using the `updatedMicros` object.

## 3. Technical Task - FRONTEND (`FoodDiaryView.tsx`)

### 3.1 handleUpdateWeight
- Remove the local regex scaling `newContent.replace(...)`.
- Instead, after `apiClient.updateMealLog` succeeds, just call `getChatHistory` for that day to get the perfectly synced text from the server. (It's safer than trying to mock the complex reconstruction on the client).

## 4. Verification
1. Log Honey (40g).
2. Edit to 100g.
3. **F5 (Refresh)**. Verify: Calories ~305, Protein 0g, Fat 0g, Carbs ~85g. (No crazy 160g values).

Использованные скиллы: [list of skill names from vitograph_skills.json]
