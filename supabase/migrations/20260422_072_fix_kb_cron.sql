-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH — Task 3: Fix Automatic Ingestion Pipeline
-- Execute manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Unschedule the buggy cron job that was infinitely looping
SELECT cron.unschedule('kb-ingest-worker');

-- 2. Clear out the corrupted, dead messages from the queue
SELECT pgmq.purge_queue('kb_ingest');

-- 3. Reschedule the worker using pgmq.pop() so it safely removes processing tasks
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
    -- We use POP instead of READ so we don't hold messages forever if pg_net lacks callbacks!
    FROM pgmq.pop('kb_ingest') AS msg
    WHERE msg IS NOT NULL;
    $$
);
