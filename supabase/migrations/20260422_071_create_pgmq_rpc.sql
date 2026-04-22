-- 1. Создаем функцию-обертку над pgmq
CREATE OR REPLACE FUNCTION kb_ingest_enqueue_batch(p_payload JSONB)
RETURNS void AS $$
BEGIN
    PERFORM pgmq.send('kb_ingest', p_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Отзываем права у всех публичных ролей (ЗАЩИТА ОТ СПАМА/DDOS)
REVOKE EXECUTE ON FUNCTION kb_ingest_enqueue_batch(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kb_ingest_enqueue_batch(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION kb_ingest_enqueue_batch(JSONB) FROM authenticated;

-- 3. Даем право ТОЛЬКО сервисному ключу (Edge Function)
GRANT EXECUTE ON FUNCTION kb_ingest_enqueue_batch(JSONB) TO service_role;