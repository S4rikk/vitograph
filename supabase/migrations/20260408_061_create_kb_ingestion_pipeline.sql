-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH KB — Step 2: Ingestion Pipeline (pgmq + Trigger + pg_cron)
-- Execute manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create pgmq queue for async document ingestion
SELECT pgmq.create('kb_ingest');

-- 2. Trigger function: enqueue ingestion task on INSERT or markdown UPDATE
CREATE OR REPLACE FUNCTION kb_document_queue_ingest()
RETURNS TRIGGER AS $$
BEGIN
    NEW.status := 'pending';
    PERFORM pgmq.send(
        'kb_ingest',
        jsonb_build_object(
            'document_id', NEW.id,
            'version', NEW.version,
            'queued_at', NOW()
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER kb_documents_ingest_trigger
    BEFORE INSERT OR UPDATE OF source_markdown ON kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION kb_document_queue_ingest();

-- 3. pg_cron worker: poll queue every 30 seconds, POST to Edge Function via pg_net
SELECT cron.schedule(
    'kb-ingest-worker',
    '30 seconds',
    $$
    SELECT net.http_post(
        url := (SELECT value FROM _app_config WHERE key = 'kb_ingest_edge_function_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM _app_config WHERE key = 'service_role_key')
        ),
        body := msg.message
    )
    FROM pgmq.read('kb_ingest', 30, 1) AS msg
    WHERE msg IS NOT NULL;
    $$
);
