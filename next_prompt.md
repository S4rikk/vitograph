# TASK: Гипер-устойчивый Regex и запрет овер-теггинга

> ⚠️ ВАЖНО: Текущий баг вызван опечаткой ИИ в кавычках (`type=""marker"`). Наш regex сломался на двойных кавычках. Нужно сделать его «неубиваемым».

---

## Фикс 1: Гипер-устойчивый Regex (Frontend)
**Файл**: `apps/web/src/components/assistant/AiAssistantView.tsx`
**Линия ~105**: Замени существующий `nutrRegex` на этот вариант.

**Новый Regex**:
Он игнорирует любое количество кавычек (0, 1, 2) вокруг типа и ловит только само значение.

```typescript
const nutrRegex = /<nut[a-z]*\s+[^>]*?type=['"]*([^'"]+?)['"]*[^>]*?>([\s\S]*?)<\/nut[a-z]*>/gi;
```

---

## Фикс 2: Запрет овер-теггинга (Backend)
**Файл**: `apps/api/src/ai/src/ai.controller.ts`
**Линия ~702**: В секции `TAGS (CRITICAL)` уточни правила.

**Обнови инструкцию**:
```text
- TAGS (CRITICAL): You MUST wrap EVERY single mention of a nutrient, vitamin, mineral, or blood biomarker (e.g. Glucose, Iron) in <nutr type="marker">Label</nutr> tags.
  ⛔ STRICT FORBIDDEN: NEVER tag medical conditions, diseases, or diagnoses (e.g., ДО НЕ ТЕГАЙ "нейтропения", "анемия", "диабет"). Tag ONLY the substance or marker itself.
```

---

## Верификация
1. Передать строку `<nutr type=""marker">тест</nutr>` — она ДОЛЖНА отрендериться как баджик, а не как текст.
2. Проверить ответ ИИ: он не должен оборачивать "нейтропению" в теги.

**Использованные скиллы: @frontend-developer, @regex-expert, @prompt-engineering-patterns**
