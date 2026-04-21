# Зависимости и Взаимодействие с Базой Данных (VITOGRAPH)

> **Дата составления:** 20 апреля 2026
> **Контекст:** Актуальная карта взаимодействия компонентов с базой данных.

В проекте используется база данных **Supabase / PostgreSQL** (версия 15+). Управление схемой осуществляется через **SQL-миграции** в директории `supabase/migrations/`. ORM **не используется** — все компоненты работают через Supabase SDK (REST/PostgREST).

## 1. Топология подключений к БД (Текущее состояние)

Проект является монорепозиторием с разделением стека. Связь с базой происходит через **два паттерна**:

### A. Next.js Frontend (`apps/web`)

Фронтенд использует **Supabase JS Client** (`@supabase/supabase-js`, `@supabase/ssr`):
- **Подключение:** HTTP (REST API / PostgREST).
- **Использование:**
  - Supabase Auth (регистрация, логин, сессии).
  - Storage (сохранение загруженных анализов `source_file_path`).
  - Supabase Realtime (`postgres_changes`) для async OCR job tracking (`lab_scans`).
  - Прямые CRUD запросы к `profiles`, `water_logs`, `user_active_skills` — защищены автоматически через RLS (`auth.uid()`).
  - Прокси через API-клиент (`api-client.ts`) к Node.js AI Engine и Python Core API.

### B. Python FastAPI Core API (`apps/api`)

**Не использует ORM** (SQLAlchemy, Prisma и т.п.).
- **Подключение:** `supabase.AsyncClient` из библиотеки `supabase` (Python).
- **Конфиг:** `apps/api/core/database.py` — Singleton Manager `SupabaseClientManager`.
- **Механизм:** Все запросы через REST HTTP к PostgREST API Supabase.
- **Интеграция RLS:**
  - Роуты принимают Bearer JWT токен с фронтенда.
  - `get_supabase_client()` создает scoped-клиент от имени юзера через `ClientOptions(headers={"Authorization": token})`.

### C. Node.js AI Engine (Express) (`apps/api/src/ai`)

- **Связь с БД:** `@supabase/supabase-js` (полностью).
- **Прямое подключение:** `PostgresSaver` (LangGraph checkpoints) через `SUPABASE_DB_URL` (postgres:// URL напрямую, без PostgREST).
- Напрямую читает/пишет в таблицы: `ai_chat_messages`, `meal_logs`, `meal_items`, `profiles`, `supplement_logs`, `push_subscriptions`, `water_logs`, `user_memory_vectors`, `user_emotional_profile`, `user_active_skills`, `biomarker_note_cache`.
- Использует `web-push` для VAPID push notifications.

---

## 2. Управление схемой данных

**Source of Truth:** SQL-миграции в `supabase/migrations/`.

- **Конвенция именования:** `YYYYMMDD_NNN_description.sql` (e.g. `20260419_070_add_cooking_method.sql`).
- **Текущий последний номер:** `070`.
- **Legacy:** Директория `apps/api/src/ai/migrations/` — устаревшая, **не используется** для новых миграций.
- **Edge Functions и триггеры:** Определены в SQL-миграциях (RLS-политики, `pg_cron`, `pg_net`, triggers).

> **Важно:** Prisma ORM **не используется** в проекте. Файл `prisma/schema.prisma` является legacy-артефактом и **не является** source of truth.

---

## 3. Ключевые риски

| Риск | Описание |
|:--|:--|
| **RLS-политики вручную** | При создании новых таблиц необходимо вручную писать SQL RLS-политики. Нет автогенерации. |
| **Python Pydantic sync** | Изменение имен колонок требует ручного обновления `apps/api/schemas/` (Pydantic V2 schemas). |
| **Двойной доступ к БД** | Node.js и Python оба пишут в `profiles`, `meal_logs` — синхронизация через RLS. |
| **PostgresSaver direct** | Checkpointer подключается через raw postgres:// URL, минуя PostgREST и пулинг. |
