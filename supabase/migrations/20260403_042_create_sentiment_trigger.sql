-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH Memory Architecture v2.0 — Sentiment Trigger
-- Prerequisites: pg_net extension must be enabled
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires on new user messages, calls Edge Function
CREATE OR REPLACE FUNCTION trigger_sentiment_extraction()
RETURNS trigger AS $$
DECLARE
    edge_url TEXT;
    service_key TEXT;
BEGIN
    -- Only process fresh user messages (not batch imports or migrations)
    IF NEW.role = 'user' AND NEW.created_at > NOW() - INTERVAL '5 minutes' THEN
        -- Read config from _app_config table
        SELECT value INTO edge_url FROM _app_config WHERE key = 'edge_function_url';
        SELECT value INTO service_key FROM _app_config WHERE key = 'service_role_key';
        
        -- Guard: skip if not configured
        IF edge_url IS NOT NULL AND service_key IS NOT NULL THEN
            PERFORM net.http_post(
                url := edge_url || '/sentiment-extractor',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                ),
                body := jsonb_build_object(
                    'user_id', NEW.user_id::TEXT,
                    'message', NEW.content,
                    'thread_id', NEW.thread_id
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to ai_chat_messages table
DROP TRIGGER IF EXISTS on_user_message_insert ON ai_chat_messages;

CREATE TRIGGER on_user_message_insert
    AFTER INSERT ON ai_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sentiment_extraction();
