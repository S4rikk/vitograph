# TASK: Full Router Removal — Purge ourzhishi.top from Codebase

**Required Skills:**
- Read `C:\store\ag_skills\skills\systematic-debugging\SKILL.md` before starting.
- Read `C:\store\ag_skills\skills\senior-fullstack\SKILL.md` before coding.

**Architecture Context:**

Роутер `api.ourzhishi.top` (китайский OpenAI-совместимый прокси для Gemini) **навсегда исключён из проекта**. Официальная причина: хроническая нестабильность (ECONNRESET, задержки 200-280s, периодические outage). Теперь используются только официальные API (OpenAI). Задача — полностью вычистить все следы роутера из кода, конфигов и переменных окружения.

---

## Implementation Steps

### 1. `apps/api/src/ai/src/llm-client.ts` — ПОЛНАЯ ЧИСТКА ROUTER-ЛОГИКИ

Это главный файл. Убери весь router-специфичный код.

**Удалить целиком:**
- Импорт `createOpenAI` из `"@ai-sdk/openai"` (строка 18 — убрать `createOpenAI` из импорта, оставить `openai`)
- Переменную `routerProvider` (строки 27–30 — весь блок `const routerProvider = createOpenAI({...})`)
- Объект `routerHealth` (строки 33–37)
- Функцию `isRouterHealthy()` (строки 43–52)
- Функцию `tripRouterCircuit()` (строки 55–59)
- `router: 120_000` из `LLM_TIMEOUTS` (строка 68 — убрать только эту строку, оставить `sync` и `async`)
- Поле `useRouter?: boolean` из интерфейса `LlmCallOptions` (строка 113)

**Упростить логику в `callLlmStructured()`:**
- Удалить весь блок `// 1. Determine Routing Policy` (строки 146–157) — константы `EXCLUDED_SCHEMAS`, `isExcluded`, `shouldTryRouter`
- Упростить инициализацию провайдера: всегда `openai`, всегда `options.model ?? DEFAULT_MODEL`
- Удалить `providerName` (больше не нужен, всегда `"openai"`)
- Удалить весь блок `// 3. Failover Logic` (строки 188–212) — он был нужен только для router failover
- Упростить `try/catch`: при ошибке — сразу `handleFinalFailure()`
- В `generateObject()` убрать router-специфичные параметры: `maxRetries: shouldTryRouter ? 0 : options.maxRetries` → просто `maxRetries: options.maxRetries`; `abortSignal` — просто `AbortSignal.timeout(options.timeoutMs)`

**Итого llm-client.ts станет:** чистый враппер над `openai` без какого-либо router-кода.

---

### 2. `apps/api/src/ai/src/graph/lab-report-analyzer.ts` — строка 39

```typescript
// БЫЛО:
const LAB_ANALYSIS_MODEL = "gemini-3.1-pro-preview-thinking";

// ЗАМЕНИТЬ НА:
const LAB_ANALYSIS_MODEL = "gpt-5.4-mini";
```

---

### 3. `apps/api/src/ai/src/graph/label-scanner.ts` — строка 60

Убрать параметр `useRouter: false` из вызова `callLlmStructured()` — этого поля больше нет в интерфейсе.

---

### 4. `.env` файлы — закомментировать GEMINI_API

В каждом из трёх файлов:
- `C:\project\VITOGRAPH\.env`
- `C:\project\VITOGRAPH\apps\api\src\ai\.env`
- `C:\project\VITOGRAPH\apps\api\.env`

Найди строку `GEMINI_API=...` и закомментируй её:
```
# GEMINI_API=sk-jKEVgeaAluPPWQShhxWIIzRHhL7WW2muPv5Y5VG9dbBK1YvG  # REMOVED: ourzhishi.top router deprecated 2026-03-29
```

---

### 5. `gemini_chat_speed.py` (в корне VITOGRAPH) — удалить файл

```
C:\project\VITOGRAPH\gemini_chat_speed.py
```

Это тестовый скрипт для роутера. Удалить полностью.

---

## После изменений

1. TypeScript должен компилироваться без ошибок (проверь через LSP/фоновый tsc)
2. Git commit:
   ```
   chore: remove ourzhishi.top router — switch to official OpenAI only
   ```
3. **НЕ деплоить** — Maya deployes manually.

## Skills Directive
> **WARNING:** Использование навыков обязательно, в указанном порядке:
> 1. `systematic-debugging` — читай SKILL.md перед началом
> 2. `senior-fullstack` — читай SKILL.md перед кодированием
