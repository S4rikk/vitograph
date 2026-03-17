# Task: Redesign Food Diary UI - Stage 1 (Calories, Macros, Date)

## Context
We are implementing a new mobile-first, high-quality design for the VITOGRAPH Food Diary page. This is Stage 1 of 3.
The backend API is already returning all correct nutritional values (`consumed`, `dynamicTarget`, etc.). You only need to change the frontend visualization.

**IMPORTANT RULES:**
- **Environment**: You are a fresh agent starting a new task. Do not assume any previous chat context. Follow this document precisely.
- **Workflow**: Auto-deploy and check logs using `@[/auto_deploy_vg]` workflow after completing the code. DO NOT leave broken code.
- **Tools**: Use React and Tailwind CSS for all styling. Use exact colors provided.

## Mandatory Skills to Use
You MUST strictly evaluate and apply guidelines from these skills:
- `frontend-developer`
- `react-ui-patterns`
- `tailwind-design-system`

---

## 🏗️ Execution Steps

### Step 1: Add New Design Tokens
**File:** `apps/web/src/app/globals.css`
Add these missing colors inside the `@theme inline { ... }` block, without deleting existing ones:
```css
  /* Macro Colors Stage 1 */
  --color-cal-ring-track: #FFEDD5;
  --color-cal-ring-fill: #F97316;
  --color-protein-bg: #EFF6FF;
  --color-protein-text: #2563EB;
  --color-fat-bg: #FFFBEB;
  --color-fat-text: #D97706;
  --color-carb-bg: #ECFDF5;
  --color-carb-text: #059669;
```
Add this animation outside the theme block (at the bottom of the file):
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fadeInUp 0.5s ease-out both; }
```

### Step 2: Update Date Paginator
**File:** `apps/web/src/components/diary/DatePaginator.tsx`
Redesign the cosmetic layout to match a pristine card style:
1. Outer `div` (`<div className="flex items-center...`): Change `rounded-xl` to `rounded-2xl`, remove `border border-border`, add `shadow-sm bg-white`.
2. Center label (`<span className="text-sm...`): Change `text-sm font-semibold` to `text-[15px] font-bold`.
3. Left/Right Buttons: Change their className to minimal square buttons: `w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-500`. Remove the complex SVG chevron, use simple text symbols "◀" and "▶".

### Step 3: Redesign DailyAllowancesPanel (Top Half Only)
**File:** `apps/web/src/components/diary/DailyAllowancesPanel.tsx`

**DO NOT CHANGE:**
- Props definitions (`consumed`, `dynamicTarget`, etc.)
- Normalization mapping and functions at the top of the file
- Aggregation logic before the `return` statement
- The Micronutrients Toggle button and list (everything below `{/* Micronutrients Toggle */}`)

**CHANGE:**
Replace the entire top section (the `div` containing the old Teal Calorie circle and linear bars) with a new modular layout.

**New Layout Structure (JSX):**
Inside the main `<div className="bg-surface-muted...` container, create a new card container for the BJU block:
`<div className="bg-white rounded-[20px] shadow-sm border border-border overflow-hidden animate-fade-in-up mb-4 mx-1 mt-1">`

Inside this new card:

**A. Calorie Header (Top row inside the card):**
Use `flex` layout (`flex items-center gap-4 px-5 pt-5 pb-1`).
- **Ring:** SVG `viewBox="0 0 80 80"`, size `w-20 h-20 shrink-0`. `circle` cx=40 cy=40 r=32. Track stroke: `text-[#FFEDD5]`, Fill stroke: `text-[#F97316]` with `stroke-linecap="round"`. The circumference is `2 * Math.PI * 32 ≈ 201`. 
- **Logic:** Calculate offset dynamically: `const cCalPercent = calcPercent(consumed.calories, Math.max(dynamicTarget.calories, 1)); const ringOffset = 201 - (cCalPercent / 100) * 201;`. **IMPORTANT:** Always use `Math.max(norm, 1)` to avoid division by zero.
- **Ring Inside:** Absolute center (using a `relative` wrapper on the SVG): `{Math.round(consumed.calories)}` (text-[22px] font-[800] leading-none), `/{dynamicTarget.calories}` (text-[9px] text-ink-muted), and an emoji `"🔥"` (text-[11px]).
- **Text right of Ring:** Column layout (`flex flex-col gap-0.5`).
  - "Калории за день" (text-sm font-bold text-ink)
  - "Осталось {dynamicTarget.calories - consumed.calories} ккал" (text-xs text-ink-muted), with the number and "ккал" bold and colored orange `#F97316`.
  - "≈ обед + перекус до нормы" (text-[11px] text-ink-faint)

**B. Macros Grid (Bottom row inside the card):**
`<div className="flex gap-2.5 px-4 pb-4 pt-2">`
**TIP:** To keep code clean (DRY), define a configuration array for the 3 macros and map over it.
1. **Белки (Protein):** bg: `bg-[#EFF6FF]`, text: `text-[#2563EB]`, Emoji: `💪`, Gradient: `bg-gradient-to-r from-[#60A5FA] to-[#2563EB]`, value: `consumed.protein`, target: `dynamicTarget.protein`.
2. **Жиры (Fats):** bg: `bg-[#FFFBEB]`, text: `text-[#D97706]`, Emoji: `🫒`, Gradient: `bg-gradient-to-r from-[#FBBF24] to-[#D97706]`, value: `consumed.fat`, target: `dynamicTarget.fat`.
3. **Углеводы (Carbs):** bg: `bg-[#ECFDF5]`, text: `text-[#059669]`, Emoji: `🌾`, Gradient: `bg-gradient-to-r from-[#34D399] to-[#059669]`, value: `consumed.carbs`, target: `dynamicTarget.carbs`.

**Card Inner Structure:**
`<div className="[bg-color] flex-1 rounded-[14px] p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md cursor-default flex flex-col items-center">`
- Emoji (text-lg mb-0.5)
- Label "БЕЛКИ" etc. (text-[9px] font-semibold uppercase tracking-wide `[text-color]`)
- Value `{Math.round(val)}` (text-[18px] font-[800] text-ink leading-none mt-1)
- " / {target}г" (text-[9px] text-ink-muted mb-2)
- Progress track (w-full h-1.5 bg-black/5 rounded-full overflow-hidden)
- Progress fill (h-full rounded-full transition-all `[gradient-color]` width based on `calcPercent(val, Math.max(target, 1))`)
- Percent `{Math.round(pct)}%` (text-[10px] font-bold mt-1.5 `[text-color]`)

### Step 4: Adjust FoodDiaryView Layout
**File:** `apps/web/src/components/diary/FoodDiaryView.tsx`
- Remove the top header with the book icon and "Дневник питания" `<h3>` text (lines ~217-236). We don't need this duplicate title.
- Make sure `DatePaginator` and `DailyAllowancesPanel` flow nicely.
- Remove `border-b` from the `DatePaginator` container if it looks cluttered.

## Verification
1. Review the code to ensure NO micronutrient rendering logic or backend data mapping was deleted.
2. Ensure you didn't break React hooks by removing or renaming variables.
3. Run the deployment `@[/auto_deploy_vg]`. Wait for it to finish and check the final PM2 log snippet for "started".

**You may begin. Create the UI magic.**
