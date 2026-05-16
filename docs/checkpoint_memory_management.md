# Checkpoint Memory Management (LangGraph PostgresSaver)

> **Последнее обновление:** 16 мая 2026
> **Статус:** ✅ Оптимизировано (v2.0)

---

## 1. Проблема

### 1.1 Симптомы
- Размер БД Supabase превысил **570 MB** (лимит Free Tier — 500 MB) при наличии всего ~5 активных пользователей.
- Таблица `public.checkpoint_blobs` занимала **436 MB (80%)** всей БД.
- Каждое сообщение пользователя приводило к росту базы на 200-500 КБ.

### 1.2 Корневая причина

LangGraph `PostgresSaver` хранит состояние диалогов в трёх таблицах: `checkpoints`, `checkpoint_blobs`, `checkpoint_writes`.

**Проблема состояла из двух частей:**

#### A. Накопительные снимки (Cumulative Snapshots)
Каждый чекпоинт сохраняет полный дамп всех сообщений потока. Если в истории 100 сообщений, новый снимок в `checkpoint_blobs` будет содержать все 100 сообщений. Следующий — 101, и так далее. Это приводило к экспоненциальному росту занимаемого места.

#### B. Неэффективная очистка (Cron Pruning)
Еженедельное задание очистки удаляло только индексные записи из `checkpoints`, но оставляло сами тяжелые данные (blobs) в базе навсегда.

---

## 2. Решение (Май 2026)

### 2.1 Экстренная очистка (SQL)
Выполнен `TRUNCATE` всех трёх таблиц для немедленного освобождения ~450 MB:
```sql
TRUNCATE checkpoint_blobs, checkpoint_writes, checkpoints;
```
*Влияние: Текущий контекст диалогов сброшен, история в UI сохранена.*

### 2.2 Исправленный Cron Pruning (SQL)
Обновлено задание `checkpoint-pruning-weekly`. Теперь оно очищает все три таблицы и имеет более жесткие лимиты:
```sql
-- Оставляем только 15 последних состояний (было 50)
DELETE FROM checkpoints WHERE (thread_id, checkpoint_id) NOT IN (... LIMIT 15);
-- Удаляем осиротевшие блобы и записи writes
DELETE FROM checkpoint_writes WHERE (thread_id, checkpoint_id) NOT IN (SELECT thread_id, checkpoint_id FROM checkpoints);
DELETE FROM checkpoint_blobs WHERE thread_id NOT IN (SELECT DISTINCT thread_id FROM checkpoints);
```

### 2.3 Внедрение Message Trimming (Код)
В файл `apps/api/src/ai/src/graph/builder.ts` добавлена логика автоматической обрезки сообщений в состоянии графа.

**Механизм:**
При каждом ответе агента проверяется количество сообщений в `state.messages`. Если оно превышает **20**, самые старые сообщения помечаются как удаленные через `RemoveMessage`.
```typescript
const PRUNE_THRESHOLD = 20;
if (convoMessages.length > PRUNE_THRESHOLD) {
    const toRemove = convoMessages.slice(0, convoMessages.length - PRUNE_THRESHOLD);
    const pruneSignals = toRemove.map(m => new RemoveMessage({ id: m.id }));
    return { messages: [...pruneSignals, response] };
}
```
**Эффект:** Размер каждого снимка в БД теперь ограничен ~20 сообщениями (~20-40 КБ max), что предотвращает бесконечный рост базы.

---

## 3. Архитектура памяти

### 3.1 Lifecycle сообщения (v2.0)
```
Пользователь → Сообщение
  ↓
Граф → Проверка лимита (20 сообщений)
  ↓
Если превышен → Генерация RemoveMessage для старых записей
  ↓
Сохранение чекпоинта → Snapshot содержит только 20 сообщений
```

### 3.2 Сравнение размеров
| Параметр | До оптимизации | После оптимизации |
|:---|:---|:---|
| Лимит чекпоинтов на thread | 50 | 15 |
| Лимит сообщений в снимке | Безлимитно | 20 |
| Средний размер снимка (blob) | 200-500 КБ | 15-30 КБ |
| Макс. размер БД на 10 пользователей | ~1 ГБ | ~40-60 МБ |

---

## 4. Связанные файлы
- `apps/api/src/ai/src/graph/builder.ts` — Логика Message Trimming.
- `supabase/migrations/20260403_043_create_cron_jobs.sql` — Базовая конфигурация Cron (требует ручного апдейта исправленным SQL).
- `docs/memory_architecture.md` — Общая архитектура памяти проекта.
