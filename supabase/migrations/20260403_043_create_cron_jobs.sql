-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH Memory Architecture v2.0 — Scheduled Jobs
-- Prerequisites: pg_cron and pg_net extensions must be enabled
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Job 1: Memory Consolidation (Daily 03:00 UTC) ───────────────
-- Dispatches per-user Edge Function calls for fact extraction

SELECT cron.schedule(
    'memory-consolidation-dispatch',
    '0 3 * * *',
    $$
    -- Step 1: Register users with new messages as pending
    INSERT INTO memory_consolidation_log (user_id, status)
    SELECT DISTINCT user_id, 'pending'
    FROM ai_chat_messages
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND role = 'user'
      AND user_id NOT IN (
          SELECT user_id FROM memory_consolidation_log
          WHERE status = 'pending' AND started_at > NOW() - INTERVAL '2 hours'
      );
    $$
);

-- Dispatch function: reads config from _app_config table
CREATE OR REPLACE FUNCTION dispatch_consolidation_jobs()
RETURNS void AS $$
DECLARE
    rec RECORD;
    edge_url TEXT;
    service_key TEXT;
BEGIN
    -- Read config from _app_config table (not current_setting)
    SELECT value INTO edge_url FROM _app_config WHERE key = 'edge_function_url';
    SELECT value INTO service_key FROM _app_config WHERE key = 'service_role_key';

    IF edge_url IS NULL OR service_key IS NULL THEN
        RAISE NOTICE '[Consolidation] Edge Function URL or service key not configured in _app_config. Skipping.';
        RETURN;
    END IF;

    FOR rec IN
        SELECT user_id FROM memory_consolidation_log
        WHERE status = 'pending'
          AND started_at > NOW() - INTERVAL '2 hours'
    LOOP
        PERFORM net.http_post(
            url := edge_url || '/memory-consolidator',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_key
            ),
            body := jsonb_build_object('user_id', rec.user_id::TEXT)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the dispatch 1 minute after log insertion
SELECT cron.schedule(
    'memory-consolidation-execute',
    '1 3 * * *',
    $$ SELECT dispatch_consolidation_jobs(); $$
);

-- ─── Job 2: Consolidation Retry (Daily 03:30 UTC) ────────────────

SELECT cron.schedule(
    'memory-consolidation-retry',
    '30 3 * * *',
    $$ SELECT dispatch_consolidation_jobs(); $$
);

-- ─── Job 3: Checkpoint Pruning (Weekly Sunday 04:00 UTC) ─────────
-- Keeps only the 50 most recent checkpoints per thread_id

SELECT cron.schedule(
    'checkpoint-pruning-weekly',
    '0 4 * * 0',
    $$
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
    $$
);

-- ─── Job 4: Cleanup old consolidation logs (Monthly) ─────────────

SELECT cron.schedule(
    'consolidation-log-cleanup',
    '0 5 1 * *',
    $$
    DELETE FROM memory_consolidation_log
    WHERE completed_at < NOW() - INTERVAL '30 days';
    $$
);
