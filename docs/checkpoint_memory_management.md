# Checkpoint Memory Management (LangGraph PostgresSaver)

> **Последнее обновление:** 19 апреля 2026
> **Статус:** ✅ Исправлено (v1.1)

---

## 1. Проблема

### 1.1 Симптомы
- Размер БД Supabase превысил **590 MB** (лимит Free Tier — 500 MB)
- Таблица `public.checkpoint_blobs` занимала **521 MB (88.39%)** всей БД
- Один пользователь генерировал 82% всех blob'ов (2,328 из 2,838)

### 1.2 Корневая причина

LangGraph `PostgresSaver` (`@langchain/langgraph-checkpoint-postgres`) хранит состояние диалогов в трёх таблицах:

| Таблица | Назначение | Ключ |
|:---|:---|:---|
| `checkpoints` | Индекс checkpoint'ов | `(thread_id, checkpoint_ns, checkpoint_id)` |
| `checkpoint_blobs` | Сериализованные данные (messages, tool results) | `(thread_id, checkpoint_ns, channel, version)` |
| `checkpoint_writes` | Промежуточные записи шагов графа | `(thread_id, checkpoint_ns, checkpoint_id, task_id, idx)` |

**Проблема состояла из двух частей:**

#### A. Cron Pruning не чистил blobs и writes

Еженедельный cron job (`checkpoint-pruning-weekly`) удалял старые строки только из `checkpoints`, но **не из `checkpoint_blobs`** и `checkpoint_writes`. Между этими таблицами нет FK CASCADE (design decision LangGraph — blobs адресуются по content-hash, не по checkpoint_id). Orphaned blobs накапливались бесконечно.

```sql
-- Старый (неполный) pruning — удалял только checkpoints
DELETE FROM checkpoints WHERE (thread_id, checkpoint_id) NOT IN (...);
-- checkpoint_blobs и checkpoint_writes оставались нетронутыми ❌
```

#### B. handleClearChatHistory усугублял проблему

Обработчик `DELETE /api/v1/ai/chat/history` использовал `RemoveMessage` через `appGraph.updateState()`, что **создавало новый checkpoint** (с пустым state) вместо удаления данных. Каждый "сброс истории" добавлял ~4 новых blob'а.

---

## 2. Решение (Апрель 2026)

### 2.1 Экстренная очистка (SQL)

Выполнен `TRUNCATE` всех трёх checkpoint-таблиц для немедленного освобождения ~520 MB:

```sql
TRUNCATE checkpoint_blobs, checkpoint_writes, checkpoints;
```

**Влияние:** L1 операционная память (контекст текущих диалогов) сброшена. L2 семантическая и L3 эмпатическая память не затронуты. Пользователи начинают диалог с чистого контекста, но UI-история (`ai_chat_messages`) сохранена.

### 2.2 Исправленный Cron Pruning

Обновлён cron job для корректной очистки **всех трёх таблиц**:

```sql
-- Новый pruning (полный) — каждое воскресенье в 04:00 UTC
-- 1. Удалить writes для старых checkpoints (> 30 на thread)
-- 2. Удалить сами старые checkpoints
-- 3. Удалить orphaned blobs (чей thread_id больше не существует в checkpoints)
```

Лимит снижен с 50 до **30 checkpoints/thread** для более агрессивного контроля размера.

### 2.3 Фикс handleClearChatHistory

**Файл:** `apps/api/src/ai/src/ai.controller.ts`

Заменён `RemoveMessage` + `appGraph.updateState()` на `PostgresSaver.deleteThread()` — официальный API LangGraph, который корректно удаляет данные из всех 3 таблиц в транзакции:

```typescript
// Duck-typing guard (совместимо с MemorySaver в dev-режиме)
if ('deleteThread' in checkpointer) {
  await (checkpointer as { deleteThread: (id: string) => Promise<void> })
    .deleteThread(actualThreadId);
}
```

### 2.4 Фикс handleDeleteAccount

Добавлена очистка checkpoint threads при удалении аккаунта пользователя (оба mode — `diary` и `assistant`):

```typescript
// Блок 2.5 в handleDeleteAccount — после удаления профиля, перед удалением auth
await deleteThread(`${userId}-diary`);
await deleteThread(`${userId}-assistant`);
```

---

## 3. Архитектура памяти (текущее состояние)

### 3.1 Lifecycle одного сообщения

```
Пользователь → сообщение
  ↓
LangGraph граф → создаёт checkpoint (~4 blobs):
  • messages     — полный дамп всех сообщений thread'а (самый тяжёлый)
  • branch:to:agent — метаданные маршрутизации графа
  • branch:to:tools — результаты tool calls
  • __start__    — начальный state
  ↓
Данные сохраняются в checkpoints + checkpoint_blobs + checkpoint_writes
```

### 3.2 Размер blob'ов

Каждый `messages` blob содержит **ВСЕ сообщения** от начала thread'а (кумулятивно):

| Сообщение # | Размер `messages` blob |
|:---|:---|
| 10 | ~30 KB |
| 50 | ~80 KB |
| 200+ | ~250 KB |

### 3.3 Прогноз размера после фикса

```
Максимум = threads × checkpoints/thread × blobs/checkpoint × avg_blob_size
         = 9 × 30 × 4 × ~60 KB ≈ 65 MB (теоретический максимум)
         ≈ 20-40 MB (реалистичный)
```

### 3.4 Потоки очистки

| Механизм | Частота | Что делает |
|:---|:---|:---|
| Cron `checkpoint-pruning-weekly` | Воскресенье 04:00 UTC | Оставляет 30 latest checkpoints/thread, чистит orphaned blobs |
| `DELETE /api/v1/ai/chat/history` | По действию пользователя | `deleteThread()` — полная очистка thread'а |
| `DELETE /api/v1/ai/account` | По действию пользователя | `deleteThread()` для обоих thread'ов (`-diary`, `-assistant`) |

---

## 4. Будущие улучшения

### 4.1 Message Trimming (Приоритет: Средний)

**Проблема:** Каждый `messages` blob содержит ВСЮ историю от начала thread'а. Чем длиннее диалог, тем больше каждый blob — даже при лимите в 30 checkpoints.

**Решение:** Добавить message trimming в `builder.ts` — перед сохранением checkpoint'а обрезать старые сообщения, оставляя, например, последние 50. LangGraph поддерживает это нативно через `trimMessages()`.

```typescript
// Пример: apps/api/src/ai/src/graph/builder.ts
import { trimMessages } from "@langchain/core/messages";

// В определении графа — trimmer node перед agent node
const trimmer = trimMessages({
  maxTokens: 8000,
  strategy: "last",
  tokenCounter: (msgs) => msgs.reduce((acc, m) => acc + m.content.length, 0),
});
```

**Эффект:** Каждый blob ≤ фиксированного размера (~100 KB max), независимо от длины диалога.

### 4.2 Мониторинг размера БД (Приоритет: Низкий)

Добавить периодическую проверку размера checkpoint-таблиц с алертом если превышен порог (например 100 MB):

```sql
-- Можно добавить в существующий cron как дополнительный job
SELECT cron.schedule(
    'checkpoint-size-monitor',
    '0 6 * * 1',  -- Понедельник 06:00 UTC
    $$
    DO $$
    DECLARE total_mb NUMERIC;
    BEGIN
        SELECT COALESCE(SUM(pg_total_relation_size(c.oid)) / 1024 / 1024, 0) INTO total_mb
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('checkpoints', 'checkpoint_blobs', 'checkpoint_writes');

        IF total_mb > 100 THEN
            RAISE WARNING '[CHECKPOINT MONITOR] Size = % MB — consider manual cleanup', total_mb;
        END IF;
    END $$;
    $$
);
```

### 4.3 Vacuum после массового удаления (Приоритет: Низкий)

PostgreSQL не возвращает место на диске после `DELETE` (только `TRUNCATE`). Автоматический `autovacuum` постепенно переиспользует пространство, но для немедленного эффекта можно выполнить:

```sql
VACUUM FULL checkpoint_blobs;
VACUUM FULL checkpoint_writes;
VACUUM FULL checkpoints;
```

> ⚠️ `VACUUM FULL` блокирует таблицу — выполнять только в окнах минимальной нагрузки.

---

## 5. Связанные файлы

| Файл | Роль |
|:---|:---|
| `apps/api/src/ai/src/graph/checkpointer.ts` | Инициализация PostgresSaver singleton |
| `apps/api/src/ai/src/ai.controller.ts` | handleClearChatHistory, handleDeleteAccount |
| `supabase/migrations/20260403_043_create_cron_jobs.sql` | Определение cron jobs (включая pruning) |
| `docs/memory_architecture.md` | Полная архитектура 3-уровневой памяти |
