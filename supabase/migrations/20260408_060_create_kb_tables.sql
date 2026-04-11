-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH KB — Step 1: Create Knowledge Base Tables
-- Execute manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. kb_documents — мастер таблица документов (ГЛОБАЛЬНАЯ)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE kb_documents (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title       TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL CHECK (category IN (
        'nutrition', 'supplements', 'lifestyle', 
        'diagnostics', 'mental_health', 'sleep', 
        'exercise', 'condition_protocol', 'biohacking', 'general'
    )),
    tags        TEXT[] DEFAULT '{}',
    source_markdown TEXT NOT NULL,
    language    TEXT DEFAULT 'ru',
    version     INT DEFAULT 1,
    status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'error')),
    error_message TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_documents_category ON kb_documents(category);
CREATE INDEX idx_kb_documents_status ON kb_documents(status);
CREATE INDEX idx_kb_documents_tags ON kb_documents USING GIN(tags);

ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read kb_documents" ON kb_documents
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service role can manage kb_documents" ON kb_documents
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_kb_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kb_documents_updated_at
    BEFORE UPDATE ON kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_kb_documents_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 2. kb_sections — разделы документа (H2/H3 заголовки)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE kb_sections (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    heading     TEXT NOT NULL,
    level       INT NOT NULL CHECK (level IN (1, 2, 3)),
    section_order INT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_sections_document ON kb_sections(document_id, section_order);

ALTER TABLE kb_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read kb_sections" ON kb_sections
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service role manages kb_sections" ON kb_sections
    FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════
-- 3. kb_chunks — атомарные чанки с эмбеддингами
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE kb_chunks (
    id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    document_id     BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    section_id      BIGINT REFERENCES kb_sections(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    chunk_order     INT NOT NULL,
    char_start      INT,
    char_end        INT,
    token_count     INT,
    embedding       vector(384),
    embedding_model TEXT DEFAULT 'gte-small-v1',
    search_vector   tsvector GENERATED ALWAYS AS (
        to_tsvector('russian', content)
    ) STORED,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW for semantic search (cosine distance)
CREATE INDEX idx_kb_chunks_hnsw ON kb_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN for full-text search
CREATE INDEX idx_kb_chunks_fts ON kb_chunks USING GIN(search_vector);

-- Composite indexes for traversal
CREATE INDEX idx_kb_chunks_document ON kb_chunks(document_id, chunk_order);
CREATE INDEX idx_kb_chunks_section ON kb_chunks(section_id);

ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read kb_chunks" ON kb_chunks
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service role manages kb_chunks" ON kb_chunks
    FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════
-- 4. kb_search_log — hit-rate tracking for analytics
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE kb_search_log (
    id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query_text      TEXT NOT NULL,
    query_embedding vector(384),
    results_count   INT,
    top_chunk_ids   BIGINT[],
    top_scores      FLOAT[],
    category_filter TEXT,
    was_useful      BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_search_log_user ON kb_search_log(user_id, created_at DESC);

ALTER TABLE kb_search_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages kb_search_log" ON kb_search_log
    FOR ALL USING (auth.role() = 'service_role');
