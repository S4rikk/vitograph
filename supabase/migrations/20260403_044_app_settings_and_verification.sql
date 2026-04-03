-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH Memory Architecture v2.0 — App Settings
-- EXECUTE MANUALLY in Supabase SQL Editor AFTER applying migrations
-- ═══════════════════════════════════════════════════════════════════

-- Config table (replaces ALTER DATABASE SET which is not allowed in Supabase)
CREATE TABLE IF NOT EXISTS _app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- NO RLS on this table — only SECURITY DEFINER functions access it
-- Regular users cannot see it through the API

INSERT INTO _app_config (key, value) VALUES
    ('edge_function_url', 'https://edsfslhypcbcrcenufdf.supabase.co/functions/v1'),
    ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkc2ZzbGh5cGNiY3JjZW51ZmRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgxNDYyNSwiZXhwIjoyMDg2MzkwNjI1fQ.Qd5MIshjZSVZh2Vvxd9VL_JDpmdWofSicReuW1aYQ-g')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES — Run these after applying all migrations
-- ═══════════════════════════════════════════════════════════════════

-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_memory_vectors', 'user_emotional_profile', 'memory_consolidation_log', '_app_config');

-- Check extensions
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector', 'pg_cron', 'pg_net');

-- Check RPC
SELECT proname FROM pg_proc WHERE proname = 'match_user_memories';

-- Check trigger
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'ai_chat_messages';

-- Check cron jobs
SELECT jobname, schedule FROM cron.job;

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'user_memory_vectors';
