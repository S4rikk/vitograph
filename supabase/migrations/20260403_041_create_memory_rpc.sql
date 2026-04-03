-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH Memory Architecture v2.0 — RPC Functions
-- ═══════════════════════════════════════════════════════════════════

-- Semantic memory search using cosine similarity
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
        m.id,
        m.content,
        m.memory_type,
        m.importance,
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
