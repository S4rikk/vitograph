# TASK: 5 Критических Фиксов Чата Ассистента

> ⚠️ ВАЖНО: Все изменения касаются ИИ-Ассистента (`AiAssistantView.tsx` и `ai.controller.ts`). 
> ЗАПРЕЩЕНО трогать файлы Дневника (`ChatMessage.tsx`, `FoodCard.tsx`, `food-log-parser.ts`).

---

## Фикс 1: Фантомная FoodCard (КРИТИЧЕСКИЙ)
**Файл**: `apps/web/src/components/assistant/AiAssistantView.tsx`
**Строка ~80**: `const foodLog = detectAndParseFoodLog(processed, ...)`
**Проблема**: `detectAndParseFoodLog` парсит ЛЮБОЙ текст с паттерном `"Записал Xг ..."`, даже если это рекомендация ИИ, а не реальный лог. В результате появляются карточки еды, которую юзер НЕ вносил.
**Решение**: Добавь проверку — вызывай `detectAndParseFoodLog` ТОЛЬКО если в тексте есть тег `<meal_score`. Это уникальный маркер реального лога. Рекомендации его не содержат.

```typescript
// BEFORE (line ~80):
const foodLog = detectAndParseFoodLog(processed, ...);

// AFTER:
const hasMealScore = /<meal_score\s/.test(processed);
const foodLog = hasMealScore ? detectAndParseFoodLog(processed, ...) : null;
```

---

## Фикс 2: Markdown вылезает в текст (`###`, `**`, `1.`)
**Файл**: `apps/web/src/components/assistant/AiAssistantView.tsx`
**Строка ~143**: функция `parseInline`
**Проблема**: `parseInline` обрабатывает ТОЛЬКО `**bold**`, но игнорирует `###` заголовки, нумерованные списки (`1.`, `2.`), и случаи, когда `**` стоит на границе строки.
**Решение**: Расширь `parseInline` ИЛИ добавь этап пост-обработки ПЕРЕД `parseInline` в `AssistantMessageContent`, который:
1. Удаляет `### ` и `## ` в начале строк (заменяет на пустую строку).
2. Удаляет маркеры списков: `\d+\.\s+` в начале строк (заменяет `"1. "` → `""`).
3. Заменяет `- ` (markdown bullet) в начале строк на `"• "` (красивый юникод-буллет).
4. Убедись, что `**text**` обрабатывается правильно даже когда рядом с пробелом/началом строки.

Пример пост-обработки (добавить ПЕРЕД строкой `const fragments`):
```typescript
// Strip markdown artifacts that AI sometimes generates
processed = processed
  .replace(/^#{1,4}\s+/gm, '')           // Remove ### headers
  .replace(/^\d+\.\s+/gm, '')            // Remove numbered list markers
  .replace(/^[-*]\s+/gm, '• ')           // Convert bullets to unicode
  .replace(/\*\*\s*\*\*/g, '');           // Remove empty **  **
```

---

## Фикс 3: Обрезка слов в nutr-тегах (`Маги` вместо `Магний`)
**Файл**: `apps/api/src/ai/src/ai.controller.ts`
**Строка ~696** (секция TAGS): 
**Проблема**: ИИ иногда оборачивает ЧАСТЬ слова в тег: `<nutr type="marker">Маги</nutr>й`, из-за чего "Магний" разрывается на баджик "Маги" и букву "й".
**Решение**: Добавь явное правило в промпт после "⚠️ STRICT":
```
- ⚠️ WORD BOUNDARY: ВСЕГДА оборачивай В ТЕГ ПОЛНОЕ СЛОВО ЦЕЛИКОМ. НИКОГДА не разрывай слово тегом. Правильно: <nutr type="marker">магний</nutr>. НЕПРАВИЛЬНО: <nutr type="marker">магни</nutr>й.
```

---

## Фикс 4: Теги-опечатки не парсятся (`<nutrtr>`)
**Файл**: `apps/web/src/components/assistant/AiAssistantView.tsx`
**Строка ~98**: `const nutrRegex = ...`
**Проблема**: Regex ищет `<nutr\b` — это НЕ покрывает `<nutrtr>`, `<nutrient>` и другие опечатки ИИ.
**Решение**: Замени regex на "всеядный":
```typescript
// BEFORE:
const nutrRegex = /<nutr\b[^>]*?type\w*=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/nutr>/gi;

// AFTER:
const nutrRegex = /<nut[a-z]*\s+[^>]*?type=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/nut[a-z]*>/gi;
```

---

## Фикс 5: ИИ продолжает использовать Markdown
**Файл**: `apps/api/src/ai/src/ai.controller.ts`
**Строка ~694** (FLUIDITY): 
**Проблема**: Текущее правило `"Avoid headers (###) or technical labels"` слишком мягкое. ИИ игнорирует его.
**Решение**: Замени строку 694 на:
```
- FLUIDITY: Write in clear, natural paragraphs. 
  ⛔ FORBIDDEN FORMATTING: NEVER use markdown in your responses. This means:
    - NO headers (###, ##, #)
    - NO numbered lists (1., 2., 3.)
    - NO bullet points (-, *)
    - NO bold markers (**text**)
  Instead, use natural Russian prose. Separate ideas with paragraphs (double newline).
  The ONLY allowed formatting is <nutr> tags and <meal_score> tags.
```

---

## Верификация
1. Спросить "пройдись по всем микронутриентам, скажи чего не хватает" — карточка НЕ должна появиться.
2. Ответ: текст БЕЗ `###`, `**`, `1.` — чистые абзацы.
3. Слова типа "Магний", "Витамин" — целые, не обрезаны.
4. Баджики `<nutr>` — корректно рендерятся, даже при опечатках.

**Использованные скиллы: @frontend-developer, @regex-expert, @prompt-engineering-patterns, @systematic-debugging**
