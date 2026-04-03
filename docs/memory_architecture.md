# Архитектура Долговременной Памяти Ассистента — v3.0.0

> **Автор:** Maya (Architect)  
> **Дата:** 2026-04-03  
> **Статус:** ✅ Production-Ready (Phases 1–4 complete, tested E2E)  
> **Фаза 1:** ✅ PostgresSaver  
> **Фаза 2:** ✅ Supabase Infrastructure (tables, triggers, cron)  
> **Фаза 3:** ✅ Edge Functions (deployed)  
> **Фаза 4:** ✅ API Integration (E2E tested)

## 1. Обзор

Система памяти ассистента состоит из трёх уровней + три автономных фоновых пайплайна:

| Уровень | Назначение | Хранилище | Latency |
|:---|:---|:---|:---|
| **L1: Операционная** | Контекст текущего диалога | PostgresSaver (checkpoints) | 0ms (in-state) |
| **L2: Семантическая** | Долговременные факты/воспоминания | pgvector (user_memory_vectors) | ~200-400ms (embedding + HNSW query) |
| **L3: Эмпатическая** | Эмоциональный профиль пользователя | JSONB (user_emotional_profile) | <5ms (1 row fetch) |

| Pipeline | Тип | Trigger | Исполнитель |
|:---|:---|:---|:---|
| **A: Sentiment** | Event-driven | DB trigger on INSERT | Edge Function `sentiment-extractor` |
| **B: Consolidation** | Scheduled (daily) | pg_cron 03:00 UTC | Edge Function `memory-consolidator` |
| **C: Pruning** | Scheduled (weekly) | pg_cron Sunday 04:00 | Pure SQL (no Edge Function) |

## 2. Layer 1: Операционная Память ✅

- `PostgresSaver` из `@langchain/langgraph-checkpoint-postgres`
- Checkpoints хранятся в Supabase PostgreSQL
- Graceful fallback на MemorySaver если SUPABASE_DB_URL не задан

## 3. Layer 2: Семантическая Память (pgvector) ✅

### Таблица: `user_memory_vectors`

```sql
CREATE TABLE user_memory_vectors (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'experience', 'goal', 'fear')),
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0.0 AND importance <= 1.0),
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    embedding vector(384),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_memory_vectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memories" ON user_memory_vectors
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on memories" ON user_memory_vectors
    FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_memory_vectors_hnsw
    ON user_memory_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_memory_user_type ON user_memory_vectors(user_id, memory_type);
```

### RPC: `match_user_memories()`

```sql
CREATE OR REPLACE FUNCTION match_user_memories(
    p_user_id UUID,
    query_embedding vector(384),
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7,
    filter_type TEXT DEFAULT NULL
) RETURNS TABLE (
    id BIGINT,
    content TEXT,
    memory_type TEXT,
    importance FLOAT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id, m.content, m.memory_type, m.importance,
        (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity,
        m.created_at
    FROM user_memory_vectors m
    WHERE m.user_id = p_user_id
      AND (filter_type IS NULL OR m.memory_type = filter_type)
      AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

### API-side параметры поиска

| Параметр | Значение | Обоснование |
|:---|:---|:---|
| `similarity_threshold` | **0.25** | `text-embedding-3-small` с 384d даёт score 0.25-0.40 для семантически близких текстов. Порог 0.65 слишком высок. Подтверждено E2E-тестом. |
| `match_count` | 5 | Top-5 фактов по косинусному сходству |
| `embedding model` | `text-embedding-3-small` | Dimensions: 384. Singleton `OpenAIEmbeddings` (из `@langchain/openai`) |

## 4. Layer 3: Эмпатическая Память ✅

### Таблица: `user_emotional_profile`

```sql
CREATE TABLE user_emotional_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_mood TEXT DEFAULT 'neutral',
    mood_trend TEXT DEFAULT 'stable' CHECK (mood_trend IN ('improving', 'stable', 'declining')),
    communication_style TEXT DEFAULT 'supportive' CHECK (communication_style IN ('direct', 'supportive', 'humorous')),
    trust_level FLOAT DEFAULT 0.5 CHECK (trust_level >= 0.0 AND trust_level <= 1.0),
    engagement_score FLOAT DEFAULT 0.5,
    total_interactions INT DEFAULT 0,
    positive_interactions INT DEFAULT 0,
    negative_interactions INT DEFAULT 0,
    emotional_milestones JSONB DEFAULT '[]',
    learned_preferences JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_emotional_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own emotional profile" ON user_emotional_profile
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on emotional profile" ON user_emotional_profile
    FOR ALL USING (auth.role() = 'service_role');
```

## 5. Pipeline A: Sentiment Extraction (Event-Driven) ✅

```
INSERT ai_chat_messages (role='user')
  → DB Trigger (IF created_at > NOW() - 5 min)
    → pg_net.http_post() → Edge Function sentiment-extractor
      → gpt-4o-mini sentiment classify
        → UPSERT user_emotional_profile
```

**Edge Function:** `supabase/functions/sentiment-extractor/index.ts`
- Runtime: Deno (Supabase Edge)
- Auth: Service role key (Bearer header)
- Features: ALLOWED_MOODS validation, valence clamping [-1,1], mood_trend via sliding window (5 last valences)

## 6. Pipeline B: Memory Consolidation (Daily) ✅

```
pg_cron 03:00 UTC
  → INSERT pending tasks to consolidation_log
  → FOR EACH user_id: pg_net → Edge Function memory-consolidator
    → fetch last 24h messages
    → gpt-4o-mini extract facts (temperature=0.1)
    → text-embedding-3-small generate embeddings (384d, batch)
    → UPSERT user_memory_vectors (dedup threshold 0.85)
    → UPDATE consolidation_log → 'success'

pg_cron 03:30 UTC (retry)
  → SELECT WHERE status='pending'|'failed'
  → retry failed users
```

**Edge Function:** `supabase/functions/memory-consolidator/index.ts`
- Per-fact error recovery (один сбой не ломает остальные)
- Conversation truncation: 12K chars (хвост — свежие сообщения)

### Лог таблица

```sql
CREATE TABLE memory_consolidation_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    facts_extracted INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

## 7. Pipeline C: Checkpoint Pruning (Weekly)

```sql
-- pg_cron Sunday 04:00 UTC
DELETE FROM checkpoints
WHERE (thread_id, checkpoint_id) NOT IN (
    SELECT thread_id, checkpoint_id
    FROM (
        SELECT thread_id, checkpoint_id,
               ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY checkpoint_id DESC) as rn
        FROM checkpoints
    ) ranked
    WHERE rn <= 50
);
```

## 8. Edge Functions (Deployed)

| Function | Runtime | Trigger | Auth | Status |
|:---|:---|:---|:---|:---|
| `sentiment-extractor` | Deno | DB trigger → pg_net | Service role key | ✅ Deployed |
| `memory-consolidator` | Deno | pg_cron → pg_net | Service role key | ✅ Deployed |

## 9. API Integration ✅

### Сервис: `services/memory.service.ts`

```typescript
export async function fetchAdvancedMemoryContext(
  userId: string,
  userMessage: string,
  token: string
): Promise<[EmotionalProfile | null, SemanticMemory[] | null]>
```

- **Singleton** `OpenAIEmbeddings` из `@langchain/openai` (model: text-embedding-3-small, 384d)
- **Promise.all** внутри: `fetchEmotionalProfile` || `fetchSemanticMemories`
- **Graceful degradation**: все ошибки → try/catch → null (чат не падает)
- **PGRST116** (no row found) — обрабатывается тихо (нормально для новых пользователей)

### Интеграция в ChatPromptBuilder

```typescript
// apps/api/src/ai/src/prompts/chat-prompt-builder.ts

withSemanticMemory(memories: Array<{ content: string; memory_type: string }> | null): this
// → Секция "### LONG-TERM MEMORY (CRITICAL CONTEXT)" | priority: 1

withEmotionalContext(profile: { current_mood: string; mood_trend: string; trust_level: number } | null): this
// → Секция "### EMOTIONAL CONTEXT" | priority: 1
```

### Интеграция в ai.controller.ts

Применено в **обоих** handler'ах: `handleChat` и `handleChatStream`.

```typescript
// Parallel fetch (fetchUserContext не зависит от fetchAdvancedMemoryContext)
const [dbContext, [emotionalProfile, semanticMemories]] = await Promise.all([
  fetchUserContext(token, req.user.id),
  fetchAdvancedMemoryContext(req.user.id, body.message, token),
]);

// weatherData зависит от dbContext.profile — остаётся sequential
const weatherData = await getOrFetchWeatherContext(dbContext.profile, req.user.id);

// Builder injection
const builder = new ChatPromptBuilder(...)
  .withPersona(...)
  .withEmotionalContext(emotionalProfile)   // Layer 3
  .withSemanticMemory(semanticMemories)     // Layer 2
  .withProfile(...)
  // ...
```

## 10. Data Flow (Complete)

```
User Message
    │
    ├──► [parallel] fetchUserContext (profile, meals, labs, supplements)
    ├──► [parallel] fetchAdvancedMemoryContext
    │       ├──► [parallel] SELECT user_emotional_profile
    │       └──► [parallel] OpenAI embedQuery(message) → RPC match_user_memories (top-5, threshold=0.25)
    │
    ├──► [sequential] getOrFetchWeatherContext (depends on profile)
    │
    ▼
ChatPromptBuilder
    .withPersona()
    .withEmotionalContext()     ← Layer 3 (mood, trend, trust)
    .withSemanticMemory()       ← Layer 2 (relevant facts from past)
    .withProfile()
    .withDiaryMode() / .withAssistantMode()
    .build()
    │
    ▼
LangGraph (PostgresSaver)       ← Layer 1
    │
    ├──► Response to user (sync)
    └──► INSERT ai_chat_messages
           └──► [async] Pipeline A: DB Trigger → sentiment-extractor
```

## 11. Файловая структура

```
apps/api/src/ai/src/
├── services/
│   └── memory.service.ts          ← NEW: fetchAdvancedMemoryContext
├── prompts/
│   └── chat-prompt-builder.ts     ← MODIFIED: +withSemanticMemory, +withEmotionalContext
├── ai.controller.ts               ← MODIFIED: Promise.all integration
└── graph/
    └── checkpointer.ts            ← PostgresSaver (Phase 1)

supabase/
├── functions/
│   ├── _shared/
│   │   └── cors.ts
│   ├── sentiment-extractor/
│   │   └── index.ts               ← DEPLOYED
│   └── memory-consolidator/
│       └── index.ts               ← DEPLOYED
└── migrations/
    ├── 20260403_040_create_memory_tables.sql
    ├── 20260403_041_create_memory_rpc.sql
    ├── 20260403_042_create_sentiment_trigger.sql
    ├── 20260403_043_create_cron_jobs.sql
    └── 20260403_044_app_settings_and_verification.sql
```

## 12. Переменные окружения

| Variable | Где используется | Источник |
|:---|:---|:---|
| `OPENAI_API_KEY` | memory.service.ts, Edge Functions | `.env` + `supabase secrets set` |
| `SUPABASE_URL` | memory.service.ts, Edge Functions | `.env` (auto in Edge Functions) |
| `SUPABASE_ANON_KEY` | memory.service.ts (with user token) | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Auto in Edge Functions |
| `SUPABASE_DB_URL` | checkpointer.ts (PostgresSaver) | `.env` |
