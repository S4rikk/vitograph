# VITOGRAPH — API Reference

> **Дата актуальности:** 16 Мая 2026 (обновлено: Locale Persistence, Biomarker Localization, Dynamic Norm Logic)
>
> Полный справочник всех API-эндпоинтов проекта. Документация сгенерирована из исходного кода.

---

## 1. Обзор архитектуры API

VITOGRAPH имеет **два бэкенд-сервиса**, каждый со своими маршрутами:

| Сервис                | Порт   | Технология                        | Назначение                                                   |
| :-------------------- | :----- | :-------------------------------- | :----------------------------------------------------------- |
| **Node.js AI Engine** | `3001` | Express, LangGraph, Vercel AI SDK | AI-операции: чат, анализ еды/крови/ногтей, nutrition targets |
| **Python Core API**   | `8001` | FastAPI, AsyncOpenAI              | Профили, парсинг PDF, нормы, аналитика, фидбек               |

### Аутентификация

Все защищённые эндпоинты требуют **Supabase JWT** в заголовке:

```
Authorization: Bearer <supabase_jwt_token>
```

- **Node.js**: Middleware `requireAuth` извлекает `user.id` из JWT и помещает в `req.user`.
- **Python**: JWT верифицируется через Supabase Auth API, `user_id` передаётся как path parameter.

### Формат ошибок

**Node.js** (Express):
```json
{
  "error": true,
  "message": "Error description",
  "details": [...]  // Zod validation errors (если 400)
}
```

**Python** (FastAPI):
```json
{
  "detail": "Error description"
}
```

---

## 2. Node.js AI Engine (`localhost:3001`)

### Health Check

| Метод | Путь      | Auth | Описание       |
| :---- | :-------- | :--- | :------------- |
| `GET` | `/health` | ❌    | Статус сервиса |

**Ответ:**
```json
{ "status": "ok", "version": "0.1.0", "timestamp": "2026-03-05T..." }
```

---

### 2.1 AI Routes (`/api/v1/ai/`)

Все маршруты требуют `requireAuth`. Файл: [`ai.routes.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/routes/v1/ai.routes.ts)

#### `POST /api/v1/ai/chat`

AI-диалог с LangGraph (дневник или ассистент). Поддерживает два режима: `diary` (логирование еды) и `assistant` (общий ИИ-друг).

**Тело запроса (Zod: `ChatRequestSchema`):**
```json
{
  "message": "string (1-1000 chars, required)",
  "threadId": "string (required) — ID беседы для сохранения состояния",
  "chatMode": "diary | assistant (default: diary)",
  "imageUrl": "string? — URL прикреплённого изображения",
  "userProfile": {
    "age": "number?",
    "biologicalSex": "string?",
    "dietType": "string?",
    "chronicConditions": "string[]?",
    "activityLevel": "string?",
    "is_smoker": "boolean?",
    "is_pregnant": "boolean?",
    "locale": "string (ru | en | ko | etc.)"
  }
}
```

**Ответ:** JSON body с AI-генерацией.

> 💡 **NEW (Streaming):** Для генерации ответа в реальном времени (SSE) посимвольно используется эндпоинт `POST /api/v1/ai/chat/stream`. Формат запроса аналогичен.

> ⚠️ **Timeout:** Прокси Next.js использует `axios` с timeout **900,000ms** (15 мин). Нативный `fetch` заменён из-за `UND_ERR_HEADERS_TIMEOUT` (5 мин лимит undici).
> Caddy direct route `/api/v1/*` → `:3001` с `response_header_timeout 300s`.

---

#### `GET /api/v1/ai/chat/history`

Получение истории чата пользователя.

**Ответ:** массив сообщений с метаданными.

---

#### `DELETE /api/v1/ai/chat/history`

Очистка истории чата пользователя. Удаляет все `ai_chat_messages` для данного user_id. НЕ удаляет медицинские отчёты.

---

#### `DELETE /api/v1/ai/users/me`

Полное удаление аккаунта текущего пользователя.

---

#### `POST /api/v1/ai/analyze`

Корреляционный анализ симптомов и продуктов.

**Тело запроса (Zod: `AnalyzeRequestSchema`):**
```json
{
  "symptoms": [
    {
      "foodName": "string (required)",
      "symptomName": "string (required)",
      "severity": "integer (1-10)",
      "onsetDelayMinutes": "number | null",
      "loggedAt": "ISO 8601 datetime"
    }
  ]
}
```

---

#### `POST /api/v1/ai/diagnose`

Диагностическая гипотеза на основе симптомов + биомаркеров.

**Тело запроса (Zod: `DiagnoseRequestSchema`):**
```json
{
  "symptoms": [{ "foodName": "...", "symptomName": "...", "severity": 1-10, ... }],
  "biomarkers": [
    { "code": "string", "name": "string", "value": "number" }
  ]
}
```

---

#### `POST /api/v1/ai/analyze-somatic`

Анализ фото частей тела (ногти, язык, кожа) через GPT-4o Vision.

**Тело запроса (Zod: `AnalyzeSomaticRequestSchema`):**
```json
{
  "imageBase64": "string (required) — data:image/...",
  "type": "nails | tongue | skin",
  "threadId": "string? — для продолжения беседы"
}
```

---

#### `POST /api/v1/ai/analyze-food`

Распознавание еды и БАДов на фото через GPT-4o Vision.

**Тело запроса (Zod: `AnalyzeFoodRequestSchema`):**
```json
{
  "imageBase64": "string (min 100 chars) — base64 фото еды"
}
```

**Ответ:** `FoodRecognitionOutputSchema` — массив `meal_items[]` + `supplements[]` с GI, GL и микронутриентами.

---

#### `POST /api/v1/ai/vision/label`

Анализ фото этикетки/состава продукта. Возвращает вердикт (RED / YELLOW / GREEN), расшифровку E-кодов и макронутриенты на 100г.

**Тело запроса (Zod: `AnalyzeLabelRequestSchema`):**
```json
{
  "imageBase64": "string (required) — base64 фото этикетки"
}
```

---

#### `POST /api/v1/ai/vision/wearable` 🆕

**(Phase 54)** Анализ скриншотов носимых устройств (Apple Health, Garmin, Oura). Распознает показатели сна, кардио, состава тела и метаболизма.

**Тело запроса (Zod: `AnalyzeWearableRequestSchema`):**
```json
{
  "imageBase64": "string (required) — base64 скриншота",
  "threadId": "string? — для продолжения беседы"
}
```

> ⚠️ **Примечание:** Актуальный путь в коде — `/api/v1/ai/vision/label`, а НЕ `/api/v1/ai/analyze-label`.

---

#### `POST /api/v1/ai/analyze-lab-report`

Премиум-диагностика анализов крови через GPT-4o (Chain-of-Thought).

**Тело запроса (Zod: `AnalyzeLabReportRequestSchema`):**
```json
{
  "biomarkers": [
    {
      "original_name": "string",
      "display_name": "string? (Localized name for UI)",
      "standardized_slug": "string",
      "value_numeric": "number?",
      "value_string": "string?",
      "unit": "string?",
      "reference_range": { "low": "number?", "high": "number?", "text": "string?" },
      "flag": "string?",
      "ai_clinical_note": "string?"
    }
  ]
}
```

**Ответ:** `LabDiagnosticReportSchema` — полный диагностический отчёт с паттернами, рекомендациями по диете и добавкам.

---

#### `GET /api/v1/ai/lab-reports/history`

Получение истории диагностических отчётов.

---

#### `DELETE /api/v1/ai/lab-reports/history/:timestamp`

Удаление диагностического отчёта по timestamp.

**Path params:** `timestamp` — ISO строка или unix timestamp отчёта.

---

#### `GET /api/v1/ai/somatic-history`

Получение истории соматических анализов (ногти, кожа, язык).

---

#### `GET /api/v1/ai/nutrition-targets`

**(Phase 53f)** Детерминированный расчёт персонализированных норм питания (макро + микро). Заменяет старый LLM-рекалькулятор.

**Ответ:**
```json
{
  "gl_budget": { "daily_limit": 100, "consumed": 45 },
  "micros": { "Железо": 22.5, "Витамин C": 135, "Магний": 520, ... },
  "rationale": "Нормы скорректированы: Выпуклые продольные борозды [significant] (+Железо, +B12)"
}
```

---

#### `GET /api/v1/ai/diary-macros`

Получение агрегированных макросов за конкретный день (timezone-aware).

**Query params:** `date` — дата в формате YYYY-MM-DD (опционально, по умолчанию сегодня).

**Ответ:** JSON timeline данных для панели «Инсулиновый Сёрфинг».

---

#### `GET /api/v1/ai/glycemic-timeline`

Получение гликемической кривой за конкретный день (timeline точек для SVG-графика).

**Query params:** `date` — дата в формате YYYY-MM-DD (опционально, по умолчанию сегодня).

---

#### `PATCH /api/v1/ai/meal-log/:id`

Обновление записи в дневнике питания.

**Тело запроса (Zod: `UpdateMealLogSchema`).**

---

#### `DELETE /api/v1/ai/meal-log/:id`

Удаление записи из дневника питания.

---

#### `POST /api/v1/ai/analytics/correlate-symptoms`

Корреляционный анализ симптомов с дневником питания.

---

#### `POST /api/v1/ai/push/subscribe`

Подписка на Web Push уведомления (VAPID). Сохраняет VAPID endpoint и ключи шифрования в `push_subscriptions`.

**Тело запроса:**
```json
{
  "subscription": {
    "endpoint": "string (required) — Push API endpoint",
    "keys": {
      "p256dh": "string (required) — ECDH public key",
      "auth": "string (required) — Auth secret"
    }
  }
}
```

**Ответ:** `{ success: true }`

---

#### `POST /api/v1/ai/push/unsubscribe`

Отписка от Web Push уведомлений. Удаляет запись из `push_subscriptions` по endpoint.

**Тело запроса:**
```json
{
  "endpoint": "string (required) — Push API endpoint для удаления"
}
```

**Ответ:** `{ success: true }`

---

#### `GET /api/v1/ai/cron/water-push`

**Cron-only endpoint.** Адаптивные push-напоминания о воде с эскалацией частоты.

**Auth:** Заголовок `x-cron-secret` с `CRON_SECRET` (НЕ user JWT).

**Алгоритм:**
1. Для каждой подписки JOIN с `profiles.timezone` для получения локального времени
2. Quiet hours: 22:00–06:00 (по локальному времени пользователя) — пропуск
3. Проверка потребления воды за сегодня (timezone-aware)
4. Если стаканов не изменилось — эскалация: 10 мин → 8 мин → 6 мин (и далее каждые 6 мин)
5. Если стаканов прибавилось — сброс retry_level

**Ответ:** `{ processed: number, sent: number, skipped: number }`

> ⚠️ Требует внешний cron-сервис (Vercel Cron, GitHub Actions) для вызова каждую **1 минуту**.

---

#### `GET /api/v1/ai/cron/media-cleanup`

**Cron-only endpoint.** Очистка устаревших медиафайлов из Supabase Storage (Garbage Collection). Сканирует таблицу `media_cleanup` на наличие записей с `expires_at < NOW()`.

**Auth:** Заголовок `x-cron-secret` с `CRON_SECRET`.

---

#### `DELETE /api/v1/ai/memory/long-term`

Удаление вектора долговременной семантической памяти.
Очищает векторную БД (`user_memory_vectors`) для текущего пользователя.

**Auth:** Bearer JWT обязателен.

**Ответ:** `{ success: true, count: number }`

### 2.2 Profile Routes (`/api/v1/profiles/`)

Auth: `requireAuth`. Файл: [`profiles.routes.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/routes/v1/profiles.routes.ts)

Node.js прокси к Supabase для управления профилями пользователей.

| Метод   | Путь           | Описание                                    |
| :------ | :------------- | :------------------------------------------ |
| `GET`   | `/:userId`     | Получение профиля пользователя              |
| `POST`  | `/`            | Создание профиля (onboarding)               |
| `PATCH` | `/:userId`     | Обновление профиля (invalidates norm cache). Поддерживает `locale` для синхронизации языка. |

---

### 2.3 Supplement Routes (`/api/v1/supplements/`)

Auth: `requireAuth`. Файл: [`supplement.routes.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/routes/v1/supplement.routes.ts)

#### `GET /api/v1/supplements/today`

Активный протокол добавок + логи приёма за сегодня.

**Ответ:**
```json
{
  "activeProtocol": { ... },
  "todayLogs": [{ "supplement_name": "...", "dosage_taken": "...", "taken_at": "..." }]
}
```

---

#### `POST /api/v1/supplements/log`

Логирование приёма БАДа.

**Тело запроса:**
```json
{
  "supplement_name": "string (required)",
  "dosage": "string (required)",
  "taken_at_iso": "string? — ISO datetime (default: now)",
  "was_on_time": "boolean? (default: true)",
  "source": "string? (default: manual)"
}
```

---

#### `DELETE /api/v1/supplements/log/:id`

Удаление записи о приёме БАДа.

---

### 2.3 Integration Routes (`/api/v1/integration/`)

Auth: `requireAuth`. Файл: [`integration.ts`](file:///c:/project/VITOGRAPH/apps/api/src/ai/src/routes/integration.ts)

Прокси к Python Core API для парсинга + автоматическое сохранение биомаркеров в БД.

#### `POST /api/v1/integration/norms`

Расчёт динамических норм через Python Engine.

**Тело запроса:**
```json
{
  "biomarker": "string",
  "profile": { ... ProfileSchema ... }
}
```

---

#### `POST /api/v1/integration/parse`

Парсинг PDF/DOCX/TXT анализов крови → извлечение биомаркеров + автоматическое сохранение в `test_results` и `test_sessions`.

**Content-Type:** `multipart/form-data`
**Поле:** `file` — PDF/DOCX/TXT файл

---

#### `POST /api/v1/integration/parse-image`

Парсинг ФОТО анализов крови (JPEG/PNG/HEIC) → OCR через GPT-4o Vision → извлечение биомаркеров + автоматическое сохранение.

**Content-Type:** `multipart/form-data`
**Поле:** `file` — изображение (< 50MB)

---

#### `POST /api/v1/integration/parse-image-batch`

> ⚠️ **LEGACY / FALLBACK** — синхронный. Используй только для одиночных фото или при отключённом Realtime. Таймаут 5 мин.

Парсинг НЕСКОЛЬКИХ ФОТО анализов крови (до 10 файлов). Каждая страница обрабатывается параллельно, результаты мержатся.

**Content-Type:** `multipart/form-data`
**Поле:** `files` — массив изображений (до 10 файлов)

---

#### `POST /api/v1/integration/parse-image-batch-async` 🆕

**Рекомендуемый путь для batch-загрузки.** Принимает до 10 фото и немедленно возвращает `job_id`. OCR запускается в фоне (Python `BackgroundTasks`). Результат доставляется фронтенду через Supabase Realtime (WebSocket) или polling.

**Content-Type:** `multipart/form-data`
**Auth:** Bearer JWT обязателен
**Поле:** `files` — массив изображений (до 10 файлов, суммарно ≤ 50MB)

**Ответ:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "PENDING"
  }
}
```

> 💡 **Realtime:** После получения `job_id` фронтенд подписывается на `postgres_changes` в таблице `lab_scans` с фильтром `id=eq.{job_id}`. При `status=COMPLETED` поле `result` содержит полный `LabReportExtraction`.

---

#### `GET /api/v1/integration/lab-scans/:jobId` 🆕

Pollback fallback — проверка статуса async OCR job.

**Auth:** Bearer JWT обязателен

**Ответ:** объект `lab_scans` с полями `id`, `status`, `result`, `error`, `created_at`, `updated_at`.

---

## 3. Python Core API (`localhost:8001`)

Файл: [`main.py`](file:///c:/project/VITOGRAPH/apps/api/main.py)

### Health Check

| Метод | Путь      | Auth | Описание       |
| :---- | :-------- | :--- | :------------- |
| `GET` | `/health` | ❌    | Статус сервиса |

---

### 3.1 Корневые эндпоинты

#### `POST /parse`

Парсинг PDF/DOCX/TXT → извлечение биомаркеров через AI.

**Ответ:** `LabReportExtraction` — массив `biomarkers[]` с `original_name`, `value_numeric`, `unit`, `reference_range`, `flag`.

---

#### `POST /parse-image`

Парсинг фото анализов крови → OCR через GPT-4o Vision.

**Content-Type:** `multipart/form-data`

---

#### `POST /parse-image-batch`

> ⚠️ **LEGACY / FALLBACK** — синхронный. Оставлен для обратной совместимости.

Пакетный парсинг фото анализов крови (до 10 файлов) → OCR через GPT-4o Vision. Синхронно, до 40 секунд.

**Content-Type:** `multipart/form-data`
**Поле:** `files` — массив изображений

---

#### `POST /parse-image-batch-async` 🆕

Асинхронный запуск batch OCR. Создаёт запись в `lab_scans` (`status=PENDING`), запускает `BackgroundTask` и немедленно возвращает `job_id`.

**Auth:** требует `Authorization: Bearer <jwt>` заголовок (для RLS)
**Content-Type:** `multipart/form-data`
**Поле:** `files` — массив изображений (≤10 файлов, ≤50MB суммарно)

**Ответ:**
```json
{ "job_id": "uuid", "status": "PENDING" }
```

**Жизненный цикл job:**
```
PENDING → PROCESSING → COMPLETED (result заполнен)
                     → FAILED (error заполнен)
```

---

#### `GET /lab-scans/{job_id}` 🆕

Получение статуса конкретного async OCR job. Используется как fallback polling, если Realtime не доставил результат за 60 сек.

**Auth:** требует `Authorization: Bearer <jwt>` заголовок

**Ответ:** строка из таблицы `lab_scans`: `{ id, user_id, status, file_count, result, error, created_at, updated_at }`

---

#### `POST /refresh-notes`

AI-пересчет флагов и генерация коротких интерпретаций `ai_clinical_note` для измененных показателей.

**Тело запроса:** `RefreshNotesRequest` — массив обновленных биомаркеров для обработки GPT-4o.

---

#### `POST /calculate`

Расчёт динамической нормы (Mock Logic, MVP).

**Ответ:** `NormResult`

---

### 3.2 Profiles (`/api/v1/profiles/`)

Файл: [`profiles.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/profiles.py)

| Метод   | Путь         | Описание                                                                                                                                                                                    |
| :------ | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/{user_id}` | Получение профиля пользователя                                                                                                                                                              |
| `POST`  | `/`          | Создание профиля (onboarding)                                                                                                                                                               |
| `PATCH` | `/{user_id}` | Частичное обновление профиля. **Важно:** при изменении `activity_level`, `stress_level`, `diet_type`, `environment_aqi`, `chronic_conditions` — сбрасывается кэш `active_nutrition_targets` |

---

### 3.3 Norms (`/api/v1/norms/`)

Файл: [`norms.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/norms.py)

| Метод  | Путь                   | Описание                                           |
| :----- | :--------------------- | :------------------------------------------------- |
| `POST` | `/{user_id}/calculate` | Полный пересчёт динамических норм для пользователя |

---

### 3.4 Test Results (`/api/v1/test-results/`)

Файл: [`test_results.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/test_results.py)

| Метод  | Путь                    | Описание                                                |
| :----- | :---------------------- | :------------------------------------------------------ |
| `POST` | `/{user_id}`            | Загрузка сессии анализов с биомаркерами (bulk insert)   |
| `POST` | `/{user_id}/upload-pdf` | Загрузка PDF → LLM-извлечение → возврат на предпросмотр |

---

### 3.5 Analysis (`/api/v1/analysis/`)

Файл: [`analysis.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/analysis.py)

| Метод | Путь                               | Описание                                                                                                                 |
| :---- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `GET` | `/{user_id}/sessions/{session_id}` | Сравнение биомаркеров сессии с персональными динамическими нормами. Возвращает статус: `optimal / low / high / critical` |

---

### 3.6 Analytics (`/api/v1/analytics/`)

Файл: [`analytics.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/analytics.py)

| Метод | Путь                                      | Описание                                                                  |
| :---- | :---------------------------------------- | :------------------------------------------------------------------------ |
| `GET` | `/{user_id}/micronutrient-trends?days=30` | Агрегация микронутриентов из `meal_logs` за последние N дней (1-90)       |
| `GET` | `/{user_id}/lab-schedule`                 | Прогностический календарь сдачи анализов (MVP: ферритин, Вит D, B12, ТТГ) |

---

### 3.7 Users / Feedback (`/api/v1/users/`)

Файл: [`users.py`](file:///c:/project/VITOGRAPH/apps/api/api/v1/endpoints/users.py)

| Метод  | Путь           | Описание                                                                                     |
| :----- | :------------- | :------------------------------------------------------------------------------------------- |
| `POST` | `/me/feedback` | Отправка фидбека/баг-репорта. Anti-spam: 60 сек. cooldown. Категории: bug, suggestion, other |

---

## 4. Swagger / OpenAPI

Python FastAPI автоматически генерирует интерактивную документацию:

| Инструмент   | URL                                  |
| :----------- | :----------------------------------- |
| Swagger UI   | `http://localhost:8001/docs`         |
| ReDoc        | `http://localhost:8001/redoc`        |
| OpenAPI JSON | `http://localhost:8001/openapi.json` |

> Node.js AI Engine не имеет автоматической Swagger-документации. Данный документ является единственным справочником.
