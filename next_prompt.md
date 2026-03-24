# VITOGRAPH: TECHNICAL TASK (Phase 59 - AI TEMPORAL HOTFIX)
# Objectives: Differentiate Today vs Yesterday in AI Context

## 1. Context: Temporal Overlap
The AI currently receives a sliding 24h window of meals. If a user ate breakfast 4 hours ago (Today) and another breakfast 23 hours ago (Yesterday), the AI sees them as the same day. We must fix this.

## 2. Technical Task - API (`ai.controller.ts`)

### 2.1 Update System Prompt (Line 980-987)
Modify `handleChat` to pass the full local date to the AI:
```typescript
const userTimeStr = now.toLocaleTimeString('ru-RU', { 
  hour: '2-digit', 
  minute: '2-digit',
  timeZone: timezone
});
const userDateStr = now.toLocaleDateString('ru-RU', { 
  day: '2-digit', month: '2-digit', year: 'numeric',
  timeZone: timezone
});

let systemPrompt = `You are ${dbContext.profile.ai_name || 'Maya'}...
Current User Local Date: ${userDateStr}
Current User Local Time: ${userTimeStr}
```

### 2.2 Fix `formatMealLogs` (Line 361)
Add the `Today/Yesterday` label to each meal:
```typescript
function formatMealLogs(meals: any[] | null, timezone: string = "UTC"): string {
  if (!meals || meals.length === 0) return "Сегодня пользователь ещё ничего не ел.";
  
  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

  return meals.map(m => {
    const mealDate = new Date(m.logged_at);
    const mealDateStr = mealDate.toLocaleDateString("en-CA", { timeZone: timezone });
    const isToday = mealDateStr === todayDateStr;
    const dayLabel = isToday ? "Сегодня" : "Вчера";
    
    const time = mealDate.toLocaleTimeString("ru-RU", {
      hour: '2-digit', minute: '2-digit', timeZone: timezone
    });

    let text = `- [${dayLabel}, ${time}]`;
    // ... (rest of formatting logic)
```

### 2.3 Fix `formatTodayProgress` (Line 500)
Ensure aggregation only includes items from the **current local calendar day**:
1. First, filter `meals` to include only those where `toLocaleDateString("en-CA", { timeZone: timezone })` matches today's string.
2. Only aggregate these filtered meals.

## 3. Verification
1. Log a meal today. 
2. Wait for a meal from "Yesterday" to still be in the 24h window (if possible, or simulate).
3. Ask AI: "Что я ел сегодня на завтрак?". 
4. Verify it only lists today's breakfast and correctly identifies it.

Использованные скиллы: [list of skill names from vitograph_skills.json]
