# TECHNICAL TASK (PROMPT) FOR THE CODER - WATER BAR RELOCATION

## CONTEXT
The user has requested to move the "Water Bar" (`WaterTracker.tsx`) from the top of the Diary view (where it scrolls away) down into the chat field, making it sticky at the very bottom right above the text input.

"Бар воды перенеси в чат в самый низ, пусть он будет приклеен внизу в поле чата."

## REQUIRED SKILLS
Использованные скиллы: `react-components`, `css-architecture`

## TASKS

### 1. Relocate `<WaterTracker>` in `FoodDiaryView.tsx`
- **Remove** `<WaterTracker selectedDate={selectedDate} userTimezone={userTimezone} />` from line ~354 (where it sits below `DailyAllowancesPanel`).
- **Move** it down to the `Input` section (around line 380), placing it *inside* the `sticky bottom-0` container but *above* the `FoodInputForm`.

**Current Structure:**
```tsx
<div className="sticky bottom-0 z-20 border-t border-border p-3 bg-white/80 backdrop-blur-md pb-[safe-area-inset-bottom]">
  <FoodInputForm onSubmit={handleSubmit} />
</div>
```

**New Structure:**
```tsx
<div className="sticky bottom-0 z-20 flex flex-col bg-white/80 backdrop-blur-md pb-[safe-area-inset-bottom]">
  {/* Move border-t here and adjust padding so they stack flush */}
  <div className="w-full border-t border-border">
    <WaterTracker selectedDate={selectedDate} userTimezone={userTimezone} />
  </div>
  <div className="p-3 w-full border-t border-surface-muted">
    <FoodInputForm onSubmit={handleSubmit} />
  </div>
</div>
```

### 2. Update CSS in `WaterTracker.tsx`
Since it's no longer a standalone block with a bottom border, we need to adjust its styling so it blends natively into the sticky footer.
- Open `apps/web/src/components/diary/WaterTracker.tsx`.
- Change its root container classes (around line 98).
**Old:** `className="bg-white border-b border-border px-4 py-2.5 flex items-center justify-between"`
**New:** `className="bg-transparent px-4 py-2.5 flex items-center justify-between w-full"` (We removed `bg-white` and `border-b` because the sticky parent handles the background and borders now).
- Change the loading skeleton state in `WaterTracker.tsx` (around line 89).
**Old:** `className="bg-white border-b border-border p-4 flex items-center justify-center h-16"`
**New:** `className="w-full bg-transparent px-4 py-2.5 flex items-center justify-center"`

### AUDIT
Test visually in the browser. The Water Bar should now float perfectly above the input form, staying stuck to the bottom of the screen regardless of how many chat messages exist. It should NOT have double borders separating it from the chat.
