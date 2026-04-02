# VITOGRAPH — AI Pipeline Documentation

> **Дата актуальности:** 2 Апреля 2026
>
> Документация AI/LLM пайплайна: LangGraph, GPT-4o, structured outputs, детерминированные нормы.

---

## 1. Обзор AI-архитектуры

```mermaid
graph TB
    subgraph "Node.js AI Engine (Port 3001)"
        AC[ai.controller.ts<br/>Контроллер]
        RS[request-schemas.ts<br/>Zod валидация]
        LC[llm-client.ts<br/>callLlmStructured]
        AS[ai-schemas.ts<br/>Output Schemas]

        subgraph "LangGraph (graph/)"
            B[builder.ts<br/>ReAct Agent]
            S[state.ts<br/>GraphAnnotation]
            T[tools.ts<br/>3 инструмента]
            CP[checkpointer.ts<br/>Memory]
        end

        subgraph "Standalone Analyzers"
            FVA[food-vision-analyzer.ts]
            LRA[lab-report-analyzer.ts]
            NA[nutrition-analyzer.ts]
            VA[vision-analyzer.ts]
        end
    end

    AC --> B
    AC --> FVA
    AC --> LRA
    AC --> NA
    AC --> VA
    B --> T
    B --> S
    B --> CP
    FVA --> LC
    LRA --> LC
    NA --> LC
    VA --> LC
    LC --> AS
```

---

## 2. LangGraph: ReAct Agent

Файл: [`builder.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/builder.ts)

### 2.1 Архитектура графа

```mermaid
graph LR
    START["__start__"] --> AGENT["agent<br/>(callModel)"]
    AGENT -->|"tool_calls?"| SHOULD{"shouldContinue"}
    SHOULD -->|"есть tool_calls"| TOOLS["tools<br/>(ToolNode)"]
    SHOULD -->|"нет tool_calls"| END_NODE["END"]
    TOOLS --> AGENT
```

**Модели (актуально на март 2026):**

| Роль | Модель | Temperature | Назначение |
| :--- | :----- | :---------- | :--------- |
| **Primary** | `gemini-3.1-pro-preview-thinking` | 0.2 | Режим `assistant` — через прокси `api.ourzhishi.top/v1`, env: `GEMINI_API` |
| **Diary** | `gpt-4o` | 0 | Режим `diary` — логирование еды, tool-вызовы |
| **Backup** | `gpt-4o-mini` | 0.2 | Fallback при отказе Primary |
| **Vision / Lab** | `gpt-4o` | 0.2 | Standalone analyzers (food-vision, lab-report) |

> 📌 Для assistant-режима используется цепочка: `primaryModel.withFallbacks([backupModel])`.
> Для diary-режима — `diaryModel` напрямую (GPT-4o лучше работает с tool-вызовами).

### 2.2 Оптимизации в `callModel`

1. **Token explosion prevention:** Только ПОСЛЕДНИЙ SystemMessage сохраняется (LangGraph добавляет новый на каждый запрос). Конвенционные сообщения обрезаются до **12 последних** (ранее 20).
2. **Deduplication interceptor (Phase 33.2):** Если LLM возвращает несколько `log_meal` tool_calls с одинаковым `food_name + weight_g`, дубликаты отсеиваются. Решает баг 10x дублирования.
3. **sanitizeMessages() (Phase 55):** Перед отправкой в LLM, массив сообщений проходит через санитайзер, который удаляет:
   - Orphaned AI messages с `tool_calls` без соответствующих `tool` responses → заменяются на plain AIMessage
   - Orphaned `tool` responses без parent AI message → удаляются
   - При ошибке `INVALID_TOOL_RESULTS` при invoke — last-resort retry с полной зачисткой tool-истории
4. **Phase 54 — Vision nutritionalContext:** Если запрос содержит `nutritionalContext` в configurable, в начало сообщений инжектируется SystemMessage с готовыми нутриентами от Vision, чтобы LLM не пересчитывал их самостоятельно.

### 2.3 State (GraphAnnotation)

Файл: [`state.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/state.ts)

| Поле             | Тип                   | Описание                                           |
| :--------------- | :-------------------- | :------------------------------------------------- |
| `messages`       | `BaseMessage[]`       | История беседы (reducer: `messagesStateReducer`)   |
| `medicalContext` | `Record<string, any>` | Медицинский контекст (биомаркеры, данные здоровья) |

### 2.4 Tools (Инструменты)

Файл: [`tools.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/tools.ts)

| Tool                       | Описание                                                            | Целевая таблица              |
| :------------------------- | :------------------------------------------------------------------ | :--------------------------- |
| `calculate_norms`          | Расчёт динамической нормы биомаркера через Python Core API          | — (прокси к Python)          |
| `update_user_profile`      | Точечное обновление ключа в `lifestyle_markers` JSONB               | `profiles.lifestyle_markers` |
| `log_meal`                 | Логирование приёма пищи с КБЖУ, микронутриентами и оценкой качества | `meal_logs`, `meal_items`    |
| `log_supplement_intake`    | Логирование приёма БАДа из протокола пользователя                   | `supplement_logs`            |
| `get_today_diary_summary`  | Получение дневника за сегодня (калории, макросы, список блюд)       | `meal_logs` (read-only)      |

**Сигнатура `log_meal`:**
```
meal_type: breakfast|lunch|dinner|snack|drink
food_name: string
weight_g: number
calories, protein_g, fat_g, carbs_g: number
meal_quality_score: 0-100
meal_quality_reason: string (Russian)
micronutrients: {
  vitamin_a_mcg, vitamin_c_mg, iron_mg,
  calcium_mg, vitamin_d_mcg, vitamin_b12_mcg,
  zinc_mg, magnesium_mg, folate_mcg,
  selenium_mcg, potassium_mg, sodium_mg,
  vitamin_e_mg, phosphorus_mg, omega3_g
}
```

**Сигнатура `log_supplement_intake`:**
```
supplement_name: string (e.g. "Omega-3", "Zinc")
dosage: string (e.g. "1000mg", "1 pill")
was_on_time: boolean
```

**Сигнатура `get_today_diary_summary`:**
```
dummy: string? (пустой параметр для совместимости)
→ Возвращает JSON: {
  summary_date, total_calories_today, total_protein_today,
  total_fat_today, total_carbs_today,
  meals: [{ meal_type, time, calories, items[] }]
}
```

### 2.5 Checkpointer (Память)

Файл: [`checkpointer.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/checkpointer.ts)

Используется `MemorySaver` для хранения состояния графа в памяти между запросами. `threadId` привязывает беседу к конкретному пользователю/сессии.

---

## 3. Standalone Analyzers (без LangGraph)

### 3.1 Food Vision Analyzer

Файл: [`food-vision-analyzer.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/food-vision-analyzer.ts)

```mermaid
flowchart LR
    PHOTO["Фото еды<br/>(base64)"] --> FVA["food-vision-analyzer"]
    CTX["userContext<br/>(profile, deficits, restrictions)"] --> FVA
    FVA --> GPT["GPT-4o Vision<br/>+ FoodRecognitionOutputSchema"]
    GPT --> OUT["items[] + supplements[]<br/>+ health_reaction"]
```

**Процесс:**
1. Получает `imageUrl` (публичный URL из Supabase Storage) и `userContext` (сериализованный контекст пользователя)
2. Формирует системный промпт: правила КБЖУ расчёта (USDA), оценки качества (0-100), правила трекинга БАДов (антагонисты)
3. Вызывает `callLlmStructured(GPT-4o, FoodRecognitionOutputSchema)`
4. Возвращает: продукты с нутриентами + БАДы с active_ingredients + реакция AI-друга

**Fallback (при ошибке):**
```json
{
  "items": [{ "name_ru": "Не распознано", "calories_kcal": 0, ... }],
  "supplements": [],
  "health_reaction": "Не удалось проанализировать фото.",
  "reaction_type": "neutral"
}
```

---

### 3.2 Lab Report Analyzer

Файл: [`lab-report-analyzer.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/lab-report-analyzer.ts)

```mermaid
flowchart LR
    INPUT["PDF / Фото анализов"] --> PYTHON["Python: OCR / GPT-4o Vision<br/>→ biomarkers[]"]
    PYTHON --> UI["MedicalResultsView<br/>Pause & Review"]
    UI --> CTRL["ai.controller.ts<br/>fetchUserContext()"]
    CTRL --> LRA["lab-report-analyzer<br/>+ Smart Coverage Prompt"]
    LRA --> GPT["GPT-4o<br/>maxOutputTokens: 16384"]
    GPT --> REPORT["Диагностический отчёт<br/>(паттерны, диета, добавки)"]
    REPORT --> DB["profiles.lab_diagnostic_reports<br/>(JSONB, SHA-256 дедупликация)"]
```

**Ключевые параметры:**
- **Семантический Кэш (biomarker_note_cache):** Перед вызовом LLM происходит поиск известных паттернов `(slug, flag)` в Supabase. Найденные описания инжектятся напрямую в промпт, сокращая размер контекста на 1000-2000 токенов и защищая от LLM-деградации.
- **Модель:** `gpt-4o` (temperature: 0.2)
- **maxOutputTokens:** 16384 (предотвращает обрезку больших отчётов)
- **timeoutMs:** 120000
- **Smart Coverage:** Аномальные маркеры получают детальный анализ, нормальные — краткий. Все маркеры обязательны.
- **Pause & Review:** Пользователь может отредактировать распознанные значения перед генерацией отчёта.
- **UI Feedback:** Пустые значения и нормы подсвечиваются красным (`border-rose-400`).

---

### 3.3 Vision Analyzer (Somatic)

Файл: [`vision-analyzer.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/vision-analyzer.ts)

Анализ фото ногтей/кожи/языка → `SomaticDiagnosticsOutputSchema`.

---

### 3.4 Nutrition Analyzer

Файл: [`nutrition-analyzer.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/graph/nutrition-analyzer.ts)

AI-анализ текстового описания еды (без фото) → нутриенты.

---

## 4. Zod Output Schemas (ai-schemas.ts)

Файл: [`ai-schemas.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/ai-schemas.ts) (436 строк)

| Schema                           | Назначение                                                             | Используется в           |
| :------------------------------- | :--------------------------------------------------------------------- | :----------------------- |
| `PsychologicalOutputSchema`      | CBT-ответ AI-друга (strategy, recommendations, confidence)             | `handleChat`             |
| `CorrelationOutputSchema`        | Корреляции еда-симптом                                                 | `handleAnalyze`          |
| `DiagnosticOutputSchema`         | Диагностические гипотезы + рекомендуемые тесты                         | `handleDiagnose`         |
| `SomaticDiagnosticsOutputSchema` | Маркеры с фото тела (markers[], interpretation, confidence)            | `handleAnalyzeSomatic`   |
| `FoodRecognitionOutputSchema`    | Продукты + БАДы + реакция AI (items[], supplements[], health_reaction) | `handleAnalyzeFood`      |
| `LabDiagnosticReportSchema`      | Полный диагностический отчёт по анализам крови                         | `handleAnalyzeLabReport` |

---

## 5. Контекст пользователя (ai.controller.ts)

### 5.1 `fetchUserContext(token, userId)`

Загружает из Supabase:
- `profiles` (с `lifestyle_markers`, `active_supplement_protocol`, `lab_diagnostic_reports`, `active_condition_knowledge_bases`)
- `test_results` (последние 50, с `biomarkers` JOIN)
- `meal_logs` (за сегодня)
- `supplement_logs` (за сегодня)

> **Внимание:** Фильтрация "за сегодня" (today) работает **сугубо с учетом `timezone` пользователя** (Timezone-Aware Day Boundaries) с помощью `getTzDayBoundaries()`. Это блокирует частую галлюцинацию AI, когда ужин "вчерашнего" дня ложился в сегодняшний расчет из-за разницы UTC.

### 5.2 Context Formatters

| Функция                            | Что форматирует                                  |
| :--------------------------------- | :----------------------------------------------- |
| `formatTestResults()`              | Последние анализы крови для системного промпта   |
| `formatMealLogs()`                 | Сегодняшние приёмы пищи                          |
| `formatNutritionTargets()`         | Детерминированные нормы КБЖУ + микро (Phase 53f) |
| `formatTodayProgress()`            | Суммарное потребление нутриентов за сегодня      |
| `formatDietaryRestrictions()`      | Диетические ограничения из `lifestyle_markers`   |
| `formatActiveKnowledgeBases()`     | Активные медицинские базы знаний (диагнозы)      |
| `formatActiveSupplementProtocol()` | Текущий протокол БАДов                           |
| `formatTodaySupplements()`         | Логи приёма БАДов за сегодня                     |
| `formatLabDiagnosticReport()`      | Последний диагностический отчёт                  |

---

## 6. Детерминированные нормы (Phase 53f)

### `computeDeterministicMicros(profile, activeKnowledgeBases)`

Файл: [`ai.controller.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/ai.controller.ts), строки 73-214

**Алгоритм:**
1. Начинается с базовых значений `BACKEND_BASE_MICRO_TARGETS` (17 микронутриентов)
2. Для каждого `active_condition_knowledge_bases`:
   - Извлекает `cofactors[]` из knowledge base
   - Маппит через `BACKEND_COFACTOR_MAP` (alias → каноническое имя)
   - Применяет множитель тяжести: `mild=1.15`, `moderate=1.30`, `significant=1.50`
3. Формирует `rationale` строку с объяснением применённых корректировок
4. Возвращает `{ micros, rationale }`

**Ключевое отличие от старого подхода:** 100% детерминированность (нет LLM-вызовов), стабильные результаты при каждом запросе.
