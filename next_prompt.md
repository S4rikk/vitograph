# TASK: Хотфикс — Убрать FoodCard из Ассистента

> ⚠️ ВАЖНО: Трогаем ТОЛЬКО `AiAssistantView.tsx`. Дневник НЕ трогаем.

## Проблема
Несмотря на проверку `hasMealScore`, ИИ генерирует `<meal_score>` теги даже в аналитических ответах (не при логировании еды). Это приводит к появлению фантомных FoodCard с нулями и названием «Анализ».

## Решение: Полное удаление FoodCard из Ассистента

**Файл**: `apps/web/src/components/assistant/AiAssistantView.tsx`

1.  **Удали импорт** `FoodCard` и `detectAndParseFoodLog` (строки ~8-9):
    ```diff
    - import FoodCard from "../diary/FoodCard";
    - import { detectAndParseFoodLog } from "../diary/food-log-parser";
    ```

2.  **Удали всю логику парсинга FoodLog** из `AssistantMessageContent` (строки ~79-88):
    ```diff
    - // 3. Extract Food Log if present
    - const hasMealScore = /<meal_score\s/.test(processed);
    - const foodLog = hasMealScore ? detectAndParseFoodLog(...) : null;
    - 
    - // 4. Strip technical food log string if detected
    - if (foodLog) {
    -   processed = foodLog.comment;
    - }
    ```

3.  **Удали рендер FoodCard** из JSX (строки ~139-142):
    ```diff
    - {foodLog && (
    -   <div className="my-2">
    -     <FoodCard {...foodLog.cardProps} />
    -   </div>
    - )}
    ```

4.  **Добавь очистку строки «Записал»** вместо удалённого кода (чтобы техническая строка не показывалась как текст):
    ```typescript
    // 3. Strip the technical "Записал..." line if present (it's for the Diary, not the Assistant)
    processed = processed.replace(/Записал\s+[\d.,]+\s*[гg]\s+[^:]+:\s*[\d.,]+\s*ккал[^\n]*/gi, '');
    ```

5.  **Удали `<meal_score>` теги из текста** (они тоже для Дневника). Добавь рядом:
    ```typescript
    // Strip <meal_score> tags entirely (Diary-only feature)
    processed = processed.replace(/<meal_score[^>]*\/>/gi, '');
    ```

6. **Удали `<nutr type="micro">` теги** (они тоже для Дневника). Добавь рядом:
    ```typescript
    // Strip micro-nutrient tags (Diary-only data for FoodCard)
    processed = processed.replace(/<nut[a-z]*\s+[^>]*type=["']micro["'][^>]*>[\s\S]*?<\/nut[a-z]*>/gi, '');
    ```

## Результат
- Ассистент показывает ТОЛЬКО текст с красивыми NutrPill-баджиками.
- `<meal_score>` и `<nutr type="micro">` теги полностью вычищаются.
- FoodCard остаётся эксклюзивным компонентом Дневника.

## Верификация
1. Спросить "пройдись по потреблённым микронутриентам" → НИКАКОЙ карточки.
2. Залогировать еду в Дневнике → FoodCard отображается как раньше.

**Использованные скиллы: @frontend-developer, @systematic-debugging**
