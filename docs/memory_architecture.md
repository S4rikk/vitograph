# Архитектура Долговременной Памяти Ассистента

> **Дата актуальности:** 7 апреля 2026
> **Статус:** Production

## 1. Обзор

Система памяти ассистента состоит из трёх уровней хранения и трёх автономных фоновых пайплайнов:

| Уровень | Назначение | Хранилище | Latency |
|:---|:---|:---|:---|
| **L1: Операционная** | Контекст текущего диалога | PostgresSaver (checkpoints) | 0ms (in-state) |
| **L2: Семантическая** | Долговременные факты и воспоминания | pgvector (`user_memory_vectors`) | ~200-400ms |
| **L3: Эмпатическая** | Эмоциональный профиль пользователя | JSONB (`user_emotional_profile`) | <5ms |

| Pipeline | Тип | Trigger | Исполнитель |
|:---|:---|:---|:---|
| **A: Sentiment** | Event-driven | DB trigger on INSERT | Edge Function `sentiment-extractor` |
| **B: Consolidation** | Scheduled (daily) | pg_cron 03:00 UTC | Edge Function `memory-consolidator` |
| **C: Pruning** | Scheduled (weekly) | pg_cron Sunday 04:00 | Pure SQL (no Edge Function) |

---

## 2. Layer 1: Операционная Память

- `PostgresSaver` из `@langchain/langgraph-checkpoint-postgres`
- Checkpoints хранятся в Supabase PostgreSQL
- Graceful fallback на `MemorySaver` если `SUPABASE_DB_URL` не задан
- Pruning (weekly SQL): оставляет последние 50 checkpoints на thread

---

## 3. Layer 2: Семантическая Память (pgvector)

### Таблица: `user_memory_vectors`

```sql
CREATE TABLE user_memory_vectors (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'experience', 'goal', 'fear', 'assistant_action')),
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0.0 AND importance <= 1.0),
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    embedding vector(384),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_memory_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable SELECT for users" ON user_memory_vectors
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable INSERT for users" ON user_memory_vectors
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable UPDATE for users" ON user_memory_vectors
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable DELETE for users" ON user_memory_vectors
    FOR DELETE USING (auth.uid() = user_id);

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

### Параметры поиска (API-side)

| Параметр | Значение | Обоснование |
|:---|:---|:---|
| `similarity_threshold` | **0.25** | `text-embedding-3-small` с 384d даёт score 0.25-0.40 для семантически близких текстов |
| `match_count` | 5 | Top-5 фактов по косинусному сходству |
| `embedding model` | `text-embedding-3-small` | Dimensions: 384. Singleton `OpenAIEmbeddings` (из `@langchain/openai`) |

---

## 4. Layer 3: Эмпатическая Память

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

---

## 5. Pipeline A: Sentiment Extraction (Event-Driven)

```
INSERT ai_chat_messages (role='user')
  → DB Trigger (IF created_at > NOW() - 5 min)
    → pg_net.http_post() → Edge Function sentiment-extractor
      → gpt-4o-mini sentiment classify
        → UPSERT user_emotional_profile
```

**Edge Function:** `supabase/functions/sentiment-extractor/index.ts`
- Runtime: Deno (Supabase Edge)
- Auth: Custom secret `SENTIMENT_AUTH_KEY` (legacy JWT format, fallback to `SUPABASE_SERVICE_ROLE_KEY`)
- JWT Gateway: Disabled (`--no-verify-jwt`)
- Features: ALLOWED_MOODS validation, valence clamping [-1,1], mood_trend via sliding window (5 last valences)

> **Примечание:** Supabase мигрировала auto-injected `SUPABASE_SERVICE_ROLE_KEY` на новый формат `sb_secret_*`. Для совместимости с `_app_config` (который хранит legacy JWT ключ) используется кастомный секрет `SENTIMENT_AUTH_KEY`.

---

## 6. Pipeline B: Memory Consolidation (Daily)

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
- Auth: Custom secret `SENTIMENT_AUTH_KEY` (аналогично sentiment-extractor)
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

---

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

---

## 8. Edge Functions

| Function | Runtime | Trigger | Auth | JWT Gateway |
|:---|:---|:---|:---|:---|
| `sentiment-extractor` | Deno | DB trigger → pg_net | `SENTIMENT_AUTH_KEY` | Disabled |
| `memory-consolidator` | Deno | pg_cron → pg_net | `SENTIMENT_AUTH_KEY` | Disabled |
| `generate-skill-document` | Deno | DB Webhook (ON INSERT `user_active_skills`) | Supabase Gateway | Default |
| `match-skill-context` | Deno | HTTP call from Node.js | Supabase Gateway | Default |

### generate-skill-document
Автоматически генерирует персонализированный медицинский протокол (~800 слов) при создании новой цели здоровья. Использует OpenAI gpt-4o-mini для генерации текста и Supabase.ai (gte-small) для создания embedding. Сохраняет результат в `user_active_skills.skill_document`.

### match-skill-context
При каждом сообщении пользователя embedding сообщения сравнивается с embedding'ами активных skill documents через pgvector (cosine similarity, threshold 0.6). При совпадении весь протокол инжектируется в системный промпт через `ChatPromptBuilder.withSkillDocument()`.

---

## 9. API Integration

### Сервис: `services/memory.service.ts`

```typescript
export async function fetchAdvancedMemoryContext(
  userId: string,
  userMessage: string,
  token: string
): Promise<[EmotionalProfile | null, SemanticMemory[] | null, SemanticMemory[] | null]>
```

- **Singleton** `OpenAIEmbeddings` (model: text-embedding-3-small, 384d) — exported for reuse
- **Promise.all** внутри: `fetchEmotionalProfile` || `fetchSemanticMemories` || `fetchPastActions`
- **Graceful degradation**: все ошибки → try/catch → null (чат не падает)
- **PGRST116** (no row found) — обрабатывается тихо (нормально для новых пользователей)

### Интеграция в ChatPromptBuilder

```typescript
withSemanticMemory(memories): this
// → Секция "### LONG-TERM MEMORY (CRITICAL CONTEXT)"

withPastActions(actions): this
// → Секция "### YOUR PAST ACTIONS & RECOMMENDATIONS (ANTI-REPETITION)"

withEmotionalContext(profile): this
// → Секция "### EMOTIONAL CONTEXT"
```

### Интеграция в ai.controller.ts

```typescript
// Parallel fetch
const [dbContext, [emotionalProfile, semanticMemories, pastActions]] = await Promise.all([
  fetchUserContext(token, req.user.id),
  fetchAdvancedMemoryContext(req.user.id, body.message, token),
]);

const builder = new ChatPromptBuilder(...)
  .withPersona(...)
  .withEmotionalContext(emotionalProfile)   // Layer 3
  .withSemanticMemory(semanticMemories)     // Layer 2
  .withPastActions(pastActions)             // Episodic (anti-repetition)
  // ...
```

### Episodic Memory (Past Actions)

| Параметр | Значение |
|:---|:---|
| `filter_type` | `assistant_action` |
| `match_count` | 3 |
| `threshold` | 0.25 |

**Tool:** `log_assistant_action` (internal, invisible to user)
- Triggers: medical recommendations, test prescriptions, supplement assignments, diet changes
- Dedup: cosine similarity threshold 0.85
- Importance: 0.7

---

## 10. User Active Skills (Goal Journeys)

### Таблица: `user_active_skills`

Каждая цель здоровья хранится как «активный скилл» с:
- FSM lifecycle: `active → paused → completed → abandoned`
- Ordered step plan (JSONB array)
- Medical diagnosis basis
- Max 3 active skills per user
- `skill_document` — персонализированный медицинский протокол
- `skill_embedding` — vector(384) для контекстного роутинга

### Step Schema (JSONB)
```json
[
  { "order": 1, "title": "...", "status": "active|pending|completed|skipped" }
]
```

### Tool: `manage_health_goals`
Actions: `add`, `add_with_plan`, `remove`, `pause`, `resume`, `advance_step`

### Service: `skills.service.ts`
`fetchActiveSkills(userId, token)` — returns top-3 active skills ordered by priority.
Called in parallel alongside `fetchUserContext()` and `fetchAdvancedMemoryContext()`.

### Prompt Integration
`ChatPromptBuilder.withActiveSkills()` injects ONLY the current step of each active skill (~200 tokens).

### Skill Document Flow
1. `manage_health_goals(add_with_plan)` → INSERT into `user_active_skills`
2. Database Webhook → Edge Function `generate-skill-document`
3. Edge Function → OpenAI (generate protocol) + Supabase.ai (generate embedding)
4. UPDATE skill with `skill_document`, `skill_embedding`, `document_status = 'ready'`

### Context Routing Flow
1. User sends message → Node.js calls Edge Function `match-skill-context`
2. Edge Function → Supabase.ai (embed message) → RPC (pgvector search, threshold 0.6)
3. Returns matching `skill_document` if found
4. `ChatPromptBuilder.withSkillDocument()` injects protocol into system prompt
5. Fallback: if `document_status ≠ 'ready'` → используется `withActiveSkills()` (step list)

### Cascade Cleanup
SQL trigger `cleanup_skill_memories` removes `linked_goal_id` from episodic memories when a skill is abandoned or completed.

### Embedding Strategy

| Контекст | Модель | Размерность | Стоимость |
|:---|:---|:---|:---|
| Skill documents | gte-small (Supabase.ai) | 384d | Бесплатно |
| Episodic memory | text-embedding-3-small (OpenAI) | 384d | Платно |
| Context routing | gte-small (Supabase.ai) | 384d | Бесплатно |

---

## 11. AI Coaching Mode

### Strategy: Pure Prompt Engineering
Нет новых таблиц, сервисов или эндпоинтов. Всё поведение коучинга управляется через инъекцию промпта.

### Method: `ChatPromptBuilder.withCoachingMode(activeSkills, isFirstMessageOfDay)`
- Инжектируется ТОЛЬКО в assistant mode (не diary)
- Содержит правила Motivational Interviewing (MI)
- Строит specialist context из `diagnosis_basis.pattern`
- На первое сообщение дня: инструкция `[PROACTIVE_SKILL_CHECK_IN]`

### Emotional Coaching Adaptation
`withEmotionalContext()` включает coaching-специфичные tone rules:
- stressed → снижать давление
- motivated → использовать momentum для micro-tasks
- declining → приоритет эмоциональной поддержки

### Alert Merging
При одновременном срабатывании weather alert и skill check-in, инструкция `[MERGE_ALERTS]` объединяет их в один абзац.

---

## 12. Data Flow (Complete)

```
User Message
    │
    ├──► [parallel] fetchUserContext (profile, meals, labs, supplements)
    ├──► [parallel] fetchAdvancedMemoryContext
    │       ├──► [parallel] SELECT user_emotional_profile
    │       ├──► [parallel] OpenAI embedQuery(message) → RPC match_user_memories (top-5, threshold=0.25)
    │       └──► [parallel] fetchPastActions → RPC match_user_memories (filter_type='assistant_action', top-3)
    ├──► [parallel] fetchActiveSkills → SELECT user_active_skills (status='active', limit 3)
    │
    ├──► [sequential] getOrFetchWeatherContext (depends on profile)
    │
    ▼
ChatPromptBuilder
    .withPersona()               ← includes EPISODIC MEMORY LOGGING rule
    .withEmotionalContext()      ← Layer 3 (mood, trend, trust)
    .withSemanticMemory()        ← Layer 2 (relevant facts from past)
    .withPastActions()           ← Episodic (anti-repetition)
    .withActiveSkills()          ← Goal Journeys (FSM, current step only)
    .withProfile()
    .withGoalManagement()        ← FSM step plan rules
    .withCoachingMode()          ← MI coaching + specialist context (assistant mode only)
    .withSkillDocument()         ← Personalized medical protocol (if context matches)
    .withDiaryMode() / .withAssistantMode()
    .build()
    │
    ▼
LangGraph (PostgresSaver)        ← Layer 1
    │
    ├──► Response to user (sync)
    ├──► [parallel] log_assistant_action tool → INSERT/DEDUP user_memory_vectors
    ├──► [parallel] manage_health_goals tool → CRUD user_active_skills (FSM transitions)
    └──► INSERT ai_chat_messages
           └──► [async] Pipeline A: DB Trigger → sentiment-extractor
```

---

## 13. Файловая структура

```
apps/api/src/ai/src/
├── services/
│   ├── memory.service.ts          ← L2+L3 fetch, embedding singleton
│   └── skills.service.ts          ← fetchActiveSkills
├── prompts/
│   └── chat-prompt-builder.ts     ← Centralized prompt builder (26 methods)
├── ai.controller.ts               ← Main controller, context formatters
└── graph/
    ├── builder.ts                 ← LangGraph ReAct Agent
    ├── state.ts                   ← GraphAnnotation (messages + medicalContext)
    ├── tools.ts                   ← 7 tools (see ai_pipeline.md)
    ├── checkpointer.ts            ← PostgresSaver
    ├── food-vision-analyzer.ts
    ├── lab-report-analyzer.ts
    ├── nutrition-analyzer.ts
    └── vision-analyzer.ts

supabase/
├── functions/
│   ├── _shared/
│   │   └── cors.ts
│   ├── sentiment-extractor/
│   │   └── index.ts               ← Event-driven (DB trigger)
│   ├── memory-consolidator/
│   │   └── index.ts               ← Scheduled (pg_cron)
│   ├── generate-skill-document/
│   │   └── index.ts               ← Webhook (ON INSERT)
│   └── match-skill-context/
│       └── index.ts               ← HTTP call from Node.js
└── migrations/
    ├── 20260403_040_create_memory_tables.sql
    ├── 20260403_041_create_memory_rpc.sql
    ├── 20260403_042_create_sentiment_trigger.sql
    ├── 20260403_043_create_cron_jobs.sql
    └── 20260403_044_app_settings_and_verification.sql
```

---

## 14. Переменные окружения

| Variable | Где используется | Источник |
|:---|:---|:---|
| `OPENAI_API_KEY` | memory.service.ts, Edge Functions | `.env` + `supabase secrets set` |
| `SUPABASE_URL` | memory.service.ts, Edge Functions | `.env` (auto in Edge Functions) |
| `SUPABASE_ANON_KEY` | memory.service.ts (with user token) | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (Supabase client init) | Auto in Edge Functions (`sb_secret_*` format) |
| `SENTIMENT_AUTH_KEY` | sentiment-extractor, memory-consolidator (auth guard) | `supabase secrets set` (legacy JWT format) |
| `SUPABASE_DB_URL` | checkpointer.ts (PostgresSaver) | `.env` |

> **Примечание:** `SENTIMENT_AUTH_KEY` содержит legacy JWT-формат ключа `eyJ...`, который совпадает с ключом в `_app_config`. Это необходимо, потому что auto-injected `SUPABASE_SERVICE_ROLE_KEY` мигрирован на формат `sb_secret_*`, и DB-триггер отправляет legacy-ключ из `_app_config`.
