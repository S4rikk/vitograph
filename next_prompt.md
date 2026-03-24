# TECHNICAL TASK (PROMPT) FOR THE CODER - MOBILE SUPPLEMENTS UI

## CONTEXT
The newly designed "Pill" checklist looks amazing, but on small mobile screens, the pills squeeze into the left side and overlap the "Calories for the day" (Калории за день) circle, breaking the layout. The user explicitly requested:
"В мобильной версии БАДы нужно в отдельную плашку между КБЖУ и микронутриентами." (In the mobile version, Supplements need to be in a separate box between the Macros and Micronutrients).

## REQUIRED SKILLS
Использованные скиллы: `react-components`, `css-architecture`, `mobile-first-design`

## TASKS

### 1. Update `SupplementChecklistWidget.tsx` with a Mobile Variant
Open `apps/web/src/components/shared/SupplementChecklistWidget.tsx`.
- Update the `Props` interface to allow the new variant: `variant?: "default" | "compact" | "mobileStrip";`
- Below the `compact` variant return block, add the rendering logic for the new `mobileStrip` variant.
- The `mobileStrip` variant should wrap pills downwards in two columns (`grid grid-cols-2 gap-2 pb-1`).
  ```tsx
  if (variant === "mobileStrip") {
    // If loading or empty, return null or skeletons matching the 2-column layout
    return (
      <div className="w-full flex flex-col gap-2">
         <h4 className="text-[11px] font-bold text-ink-muted uppercase tracking-wider px-1">Добавки на сегодня</h4>
         <div className="grid grid-cols-2 gap-2 px-1 pb-1">
             {/* Map through meds yielding the same pill buttons as 'compact', but with full width in their grid cell */}
             {meds.map(med => { ... (copy pill design here, ensure the span has 'truncate' so long text doesn't overflow) ... })}
         </div>
      </div>
    );
  }
  ```
- **Important for the Pill in `mobileStrip`:** Ensure the label has `w-full` and its inner text span has `truncate` so that very long supplement names don't break the 2-column grid layout.

### 2. Update `DailyAllowancesPanel.tsx` Layout
Open `apps/web/src/components/diary/DailyAllowancesPanel.tsx`.

**A. Hide the top-right widget on mobile:**
Find the container holding the `compact` variant (around line 257):
```tsx
<div className="flex-1 ml-4 flex justify-end h-full">
  <SupplementChecklistWidget variant="compact" startIso={startIso} endIso={endIso} />
</div>
```
Change the class to: `className="hidden sm:flex flex-1 ml-4 justify-end h-full"`

**B. Insert the new dedicated mobile strip:**
Find the space *between* the end of the BJU Block and the start of the Micronutrients Expansion Panel (around line 290).
Add this code:
```tsx
{/* ── Mobile Supplements Block ────────────────────────────────── */}
<div className="sm:hidden w-full px-1 mb-3.5">
  <div className="bg-white rounded-[20px] shadow-sm border border-border p-3.5">
    <SupplementChecklistWidget variant="mobileStrip" startIso={startIso} endIso={endIso} />
  </div>
</div>
```

### AUDIT
- Test the layout on a resized desktop window (Mobile view). The overlapping pills at the top should vanish, replaced by a beautiful, scrolling "Добавки на сегодня" strip sitting directly between the Macro cards and the Micronutrients box. On large screens, it should seamlessly swap back to the top-right pills.
