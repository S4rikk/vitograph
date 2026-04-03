-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH Memory Architecture v2.0 — Tables & Extensions
-- Author: Maya (Architect) | Date: 2026-04-03
-- ═══════════════════════════════════════════════════════════════════

-- pgvector extension already enabled via Supabase Dashboard
-- CREATE EXTENSION IF NOT EXISTS vector;  -- skip if already active

-- ─── Layer 2: Semantic Memory ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memory_vectors (
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

CREATE POLICY "Users can view own memories"
    ON user_memory_vectors FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on memories"
    ON user_memory_vectors FOR ALL
    USING (auth.role() = 'service_role');

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_memory_vectors_hnsw
    ON user_memory_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_memory_user_type
    ON user_memory_vectors(user_id, memory_type);

-- ─── Layer 3: Empathetic Memory ──────────────────────────────────

CREATE TABLE IF NOT EXISTS user_emotional_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_mood TEXT DEFAULT 'neutral',
    mood_trend TEXT DEFAULT 'stable' CHECK (mood_trend IN ('improving', 'stable', 'declining')),
    communication_style TEXT DEFAULT 'supportive' CHECK (communication_style IN ('direct', 'supportive', 'humorous')),
    trust_level FLOAT DEFAULT 0.5 CHECK (trust_level >= 0.0 AND trust_level <= 1.0),
    engagement_score FLOAT DEFAULT 0.5 CHECK (engagement_score >= 0.0 AND engagement_score <= 1.0),
    total_interactions INT DEFAULT 0,
    positive_interactions INT DEFAULT 0,
    negative_interactions INT DEFAULT 0,
    emotional_milestones JSONB DEFAULT '[]',
    learned_preferences JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_emotional_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emotional profile"
    ON user_emotional_profile FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on emotional profile"
    ON user_emotional_profile FOR ALL
    USING (auth.role() = 'service_role');

-- ─── Consolidation Log (for retry mechanism) ─────────────────────

CREATE TABLE IF NOT EXISTS memory_consolidation_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    facts_extracted INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consolidation_status
    ON memory_consolidation_log(status, started_at);
