-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH KB — Step 3: Hybrid Search RPC (Semantic + Lexical + RRF)
-- Execute manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION hybrid_search_kb(
    p_query_text TEXT,
    p_query_embedding vector(384),
    p_top_k INT DEFAULT 5,
    p_category TEXT DEFAULT NULL,
    p_rrf_k INT DEFAULT 60
) RETURNS TABLE (
    chunk_id BIGINT,
    content TEXT,
    section_heading TEXT,
    section_content TEXT,
    document_title TEXT,
    document_slug TEXT,
    category TEXT,
    semantic_score FLOAT,
    lexical_score FLOAT,
    rrf_score FLOAT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH semantic AS (
        SELECT 
            c.id,
            (1 - (c.embedding <=> p_query_embedding))::FLOAT AS score,
            ROW_NUMBER() OVER (ORDER BY c.embedding <=> p_query_embedding) AS rank
        FROM kb_chunks c
        JOIN kb_documents d ON c.document_id = d.id
        WHERE d.status = 'indexed'
          AND (p_category IS NULL OR d.category = p_category)
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> p_query_embedding
        LIMIT p_top_k * 3
    ),
    lexical AS (
        SELECT
            c.id,
            ts_rank_cd(c.search_vector, websearch_to_tsquery('russian', p_query_text))::FLOAT AS score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(c.search_vector, websearch_to_tsquery('russian', p_query_text)) DESC
            ) AS rank
        FROM kb_chunks c
        JOIN kb_documents d ON c.document_id = d.id
        WHERE d.status = 'indexed'
          AND (p_category IS NULL OR d.category = p_category)
          AND c.search_vector @@ websearch_to_tsquery('russian', p_query_text)
        ORDER BY score DESC
        LIMIT p_top_k * 3
    ),
    rrf AS (
        SELECT
            COALESCE(s.id, l.id) AS chunk_id,
            COALESCE(s.score, 0) AS sem_score,
            COALESCE(l.score, 0) AS lex_score,
            (
                COALESCE(1.0 / (p_rrf_k + s.rank), 0) +
                COALESCE(1.0 / (p_rrf_k + l.rank), 0)
            )::FLOAT AS combined_score
        FROM semantic s
        FULL OUTER JOIN lexical l ON s.id = l.id
        ORDER BY combined_score DESC
        LIMIT p_top_k
    )
    SELECT
        r.chunk_id,
        c.content,
        sec.heading AS section_heading,
        sec.content AS section_content,
        d.title AS document_title,
        d.slug AS document_slug,
        d.category,
        r.sem_score AS semantic_score,
        r.lex_score AS lexical_score,
        r.combined_score AS rrf_score
    FROM rrf r
    JOIN kb_chunks c ON r.chunk_id = c.id
    LEFT JOIN kb_sections sec ON c.section_id = sec.id
    JOIN kb_documents d ON c.document_id = d.id
    ORDER BY r.combined_score DESC;
END;
$$;
