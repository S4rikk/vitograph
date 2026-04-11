-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH KB — Step 8: _app_config Entry for kb-ingest Edge Function
-- Execute manually in Supabase SQL Editor
-- ⚠️ Project ref: edsfslhypcbcrcenufdf (from existing _app_config)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO _app_config (key, value)
VALUES ('kb_ingest_edge_function_url', 'https://edsfslhypcbcrcenufdf.supabase.co/functions/v1/kb-ingest')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
