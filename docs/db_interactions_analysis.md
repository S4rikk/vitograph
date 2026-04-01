# Зависимости и Взаимодействие с Базой Данных (VITOGRAPH)

> **Дата составления:** 2026-04-01
> **Контекст:** Анализ текущих связей компонентов для подготовки к рефакторингу БД.

В проекте используется база данных **Supabase / PostgreSQL** (версия 15+). Для управления схемой и миграциями применяется **Prisma ORM**, однако доступ к данным на уровне выполнения разбит на разные подходы. Ниже приведено полное дерево зависимостей.

## 1. Топология подключений к БД (Настоящее время)

Проект является монорепозиторием с разделением стека. Связь с базой происходит по трем принципиально разным паттернам:

### A. Next.js Frontend (`apps/web`)
Фронтенд использует гибридный подход:
1. **Prisma Client (`@prisma/client` + `@prisma/adapter-pg`)**
   - **Конфиг:** `apps/web/src/lib/prisma.ts`.
   - **Подключение:** Использует прямой `postgres://` URL (настроен через `DATABASE_URL` или Supabase Connection Pooling - Session/Transaction mode).
   - **Использование:** В основном для мощных Server Actions и обхода RLS (через сервисный доступ) для тяжелых выборок.
2. **Supabase JS Client (`@supabase/supabase-js`, `@supabase/ssr`)**
   - **Подключение:** Идет по HTTP (REST API / PostgREST).
   - **Использование:** 
     - Supabase Auth (регистрация, логин, сессии).
     - Storage (сохранение загруженных анализов `source_file_path`).
     - Real-Time subscriptions (вероятно, используется для UI обновлений графиков).
     - Клиентские запросы, защищенные автоматически через Row-Level Security (RLS) PostgreSQL. Пользовательские JWT токены пробрасывают `auth.uid()`.

### B. Python FastAPI Core API (`apps/api`)
Слой бизнес-логики и работы с ML на Python **не использует ORM** типа SQLAlchemy.
- **Подключение:** `supabase.AsyncClient` из библиотеки `supabase` (Python).
- **Конфиг:** `apps/api/core/database.py` Singleton Manager `SupabaseClientManager`.
- **Механизм:** Все запросы в БД (repositories: `profile_repository.py`, `test_result_repository.py`) выполняются через REST HTTP-запросы к PostgREST API Supabase.
- **Интеграция RLS:** 
  - Роуты Python-приложения принимают Bearer JWT токен с фронтенда (содержащий `user_id`).
  - При наличии заголовка фабрика `get_supabase_client()` создает scoped-клиент от имени юзера: `ClientOptions(headers={"Authorization": token})`.
  - Это означает, что безопасность данных поддерживается за счет RLS на уровне БД.

### C. Node.js AI Engine (Express) (`apps/api/src/ai`)
Специфический сервис, работающий в основном с LangGraph и Vercel AI SDK.
- **Связь с БД:** Полностью переведен на `@supabase/supabase-js`.
- Prisma **не используется** в кодовой базе `src/ai`.
- Проксирует запросы на AI-сервисы, напрямую читая/пиша в таблицы `ai_chat_messages`, `meal_logs` и др. через HTTP REST интерфейс Supabase. 

---

## 2. Иерархия управления схемой данных (Schema Master)

Единым источником истины (Source of Truth) для всей структуры таблиц PostgreSQL выступает **Prisma Schema**.

- **Файл:** `C:\project\VITOGRAPH\prisma\schema.prisma`
- Все таблицы (profiles, test_results, food_items, environment_readings, и т.д.) объявлены в этом файле.
- **Индексы и ключи:** Присутствуют сложные композитные индексы `@@index([userId, loggedAt])` почти на всех таблицах со временными рядами для быстрой работы Time-series запросов.
- **Связи (Relations):** Во всех таблицах настроены каскадные удаления `onDelete: Cascade` к родительской таблице `Profile` (профили удаляются → удаляются логи).
- **Миграции/SQL:** Файл `phase51_supplement_logs.sql` и папка `supabase/migrations/` намекают, что в проекте есть ручные SQL-вмешательства (напр. триггеры, функции для RLS), которые Prisma не умеет/дополняет.

---

## 3. Риски и рекомендации перед рефакторингом БД

Поскольку в проекте запланирован рефакторинг БД, следует учитывать следующие **угрозы архитектуре**:

1. **Рассинхронизация Prisma и Supabase REST:**
   - Изменение имен колонок или типов данных в `schema.prisma` потребует **ручного обновления** во всем Python-бэкенде (все файлы Pydantic-схем в `apps/api/schemas/` и репозитории в `apps/api/repositories/`), так как Python взаимодействует с БД строковыми/JSON ключами через REST, и нет строгой автогенерации типов, как это делает `Prisma Client` в TS.

2. **Зависимость от Row-Level Security (RLS):**
   - Бэкенд на Python и Next.js клиентская часть строго опираются на политику `user_id = auth.uid()`. При изменении табличных связей или создания новых таблиц необходимо вручную писать SQL RLS политики. Prisma не умеет генерировать RLS.
   
3. **Прямые SQL-запросы в RLS:**
   - Если рефакторинг коснется таблицы `profiles`, необходимо проверить все политики (policies) в панели Supabase. 

4. **Двойной пулинг соединений:**
   - `apps/web` через `PrismaPg` (postgres://) и Python/Node.js через PostgREST (http://). Это хорошо масштабируется, так как нагрузка на PgBouncer (pooler) идет только с Next.js Server Actions.

**Итог:** Рефакторинг должен начинаться строго с модификации `schema.prisma` -> `prisma db push` / `migrate`, далее — обновление TypeScript типов (`npx prisma generate`), и, что самое критичное — ручное обновление Pydantic-схем в папке `apps/api/schemas/` на Python.
