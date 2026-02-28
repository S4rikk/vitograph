-- ==============================================================================
-- Скрипт базы данных: Инициализация хранилища скриншотов обратной связи (Phase 40)
-- Выполните этот скрипт во вкладке SQL Editor в Supabase Dashboard
-- ==============================================================================
-- 1. Добавление новой колонки `attachment_url` в таблицу `feedback`
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS attachment_url text;
-- 2. Создание нового бакета для скриншотов (устанавливаем его как публичный)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        avif_autodetection,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'feedback-screens',
        'feedback-screens',
        true,
        false,
        5242880,
        -- Лимит 5 MB (в байтах)
        ARRAY ['image/jpeg', 'image/png', 'image/webp']::text []
    ) ON CONFLICT (id) DO
UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- 3. Настройка политик безопасности (RLS - Row Level Security) для бакета
-- 3.1 Разрешаем загрузку и обновление файлов всем авторизованным юзерам
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (bucket_id = 'feedback-screens');
-- 3.2 Разрешаем публичный просмотр бакета 
-- (поскольку бакет имеет флаг public = true, сама ссылка будет доступна, 
-- но политика на SELECT позволяет делать list/GET через Supabase API, если нужно)
CREATE POLICY "Public read access for screenshots" ON storage.objects FOR
SELECT TO public USING (bucket_id = 'feedback-screens');
-- 3.3 Разрешаем юзерам удалять СВОИ скрины (опционально, но полезно)
CREATE POLICY "Authenticated users can delete their screenshots" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'feedback-screens'
    AND auth.uid() = owner
);