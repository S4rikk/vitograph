# TASK: Prompt Layer Refactoring — Верификация и Тестирование

## 1. REQUIRED SKILLS & ORDER

1. Read `C:\store\ag_skills\skills\nodejs-backend-patterns\SKILL.md`

## 2. КОНТЕКСТ ПРОЕКТА

Проект **VITOGRAPH** — это Turborepo monorepo. Бэкенд (API) находится в `apps/api/`.

Maya (архитектор) выполнила рефакторинг слоя AI-промптов: вынесла inline системные промпты из файлов-обработчиков в отдельные модули с версионированием и добавила валидаторы ответов LLM.

### Что было сделано (НЕ трогай эти файлы):

**Созданы:**
- `apps/api/src/ai/src/prompts/food-vision.prompt.ts` — промпт для анализа фото еды (v2.0.0, 3 few-shot примера)
- `apps/api/src/ai/src/prompts/lab-diagnostic.prompt.ts` — промпт для анализа лабораторных анализов (v3.2.0)
- `apps/api/src/ai/src/prompts/psychological.prompt.ts` — CBT-промпт для поддерживающих ответов (v1.1.0)
- `apps/api/src/ai/src/prompts/chat-prompt-builder.ts` — класс ChatPromptBuilder для динамической сборки системного промпта чата (v1.0.0)
- `apps/api/src/ai/src/prompts/index.ts` — центральный реестр экспортов
- `apps/api/src/ai/src/validators/response-validator.ts` — 3 детерминированных валидатора (Chat, Lab, Food)

**Модифицированы:**
- `apps/api/src/ai/src/graph/food-vision-analyzer.ts` — inline промпт заменён на import из `prompts/`, добавлена пост-LLM валидация
- `apps/api/src/ai/src/graph/lab-report-analyzer.ts` — inline промпт заменён на import из `prompts/`, добавлена пост-LLM валидация
- `apps/api/src/ai/src/ai-triggers.ts` — inline PSYCHOLOGICAL_SYSTEM_PROMPT заменён на import из `prompts/`
- `apps/api/src/ai/src/ai.controller.ts` — 150 строк inline-сборки системного промпта заменены на вызов ChatPromptBuilder (строки 1150-1207)

> Для углублённого понимания архитектуры прочитай: `docs/prompt_architecture.md`

## 3. ЗАДАЧИ

### Шаг 0: Ориентация

Прочитай `docs/prompt_architecture.md` для понимания что и зачем было сделано.

### Шаг 1: Компиляция (TypeScript)

Из корня проекта (`C:\project\VITOGRAPH`) запусти:

```bash
npx tsc --project apps/api/tsconfig.json --noEmit
```

**Ожидаемый результат:**
- Возможны **PRE-EXISTING** ошибки типизации Supabase в `lab-report-analyzer.ts` (строки ~145, ~165). Они связаны с `from("biomarker_note_cache")` без typegen и были ДО рефакторинга. Их игнорируй.
- **НОВЫХ ошибок** в файлах `prompts/`, `validators/`, `food-vision-analyzer.ts`, `lab-report-analyzer.ts`, `ai-triggers.ts`, `ai.controller.ts` быть НЕ должно.

**Если есть НОВЫЕ ошибки:**
- Если ошибка в **import-путях, типах, синтаксисе экспортов** → исправь самостоятельно.
- Если ошибка в **тексте промпта** (содержание строк внутри template literals) → **ЭСКАЛАЦИЯ** (см. секцию 5).

### Шаг 2: Проверка запуска сервера

```bash
cd apps/api && npm run dev
```

Убедись, что сервер стартует без ошибок в консоли. Ищи:
- ✅ `[server] Listening on port ...` — сервер запустился
- ❌ `Cannot find module './prompts/...'` — битый import-путь
- ❌ `TypeError: ... is not a function` — неправильный экспорт
- ❌ `ChatPromptBuilder is not a constructor` — проблема с dynamic import

Если сервер НЕ стартует из-за ошибки НОВОГО кода — исправь (соблюдая ограничения секции 4).

### Шаг 3: Отчёт

Запиши отчёт в `C:\project\kOSI\next_report.md`:
```markdown
# Отчёт: Verify Prompt Layer Refactoring

## Компиляция
- Результат: [PASS/FAIL]
- Новые ошибки: [список или "нет"]
- Исправления: [что сделал или "не потребовались"]

## Запуск сервера
- Результат: [PASS/FAIL]
- Ошибки: [список или "нет"]

## Итог
[READY / NEEDS ESCALATION]
```

## 4. ОГРАНИЧЕНИЯ (СТРОГИЕ)

1. **НЕ трогай СОДЕРЖАНИЕ** файлов в `prompts/` — текст промптов, few-shot примеры, правила поведения AI. Это зона ответственности Архитектора.
2. **НЕ трогай** `validators/response-validator.ts` — написан Архитектором.
3. **НЕ трогай** `format*()` функции в `ai.controller.ts` — они передают данные в builder.
4. **НЕ добавляй** новые npm-пакеты.
5. **НЕ трогай** фронтенд (`apps/web/`).
6. **НЕ удаляй** существующий код, который НЕ был частью рефакторинга.

**Ты МОЖЕШЬ исправлять:** import-пути (`.js` расширения), TypeScript-типы, синтаксис `export/import`, `tsconfig.json` если нужно добавить путь.

## 5. ПРОТОКОЛ ЭСКАЛАЦИИ (КРИТИЧЕСКИ ВАЖНО)

Если проблема **в тексте промпта** (содержание `template` строк, few-shot примеры, правила AI, структура builder-методов):

1. **ОСТАНОВИСЬ.** Не пытайся исправить.
2. Запиши проблему в `C:\project\kOSI\next_report.md`:
   - Какой файл
   - Какая строка
   - В чём ошибка
   - **"ЭСКАЛАЦИЯ: Требуется вмешательство Архитектора (Maya)"**
3. **НЕ продолжай** работу. Дождись исправления от Архитектора.
