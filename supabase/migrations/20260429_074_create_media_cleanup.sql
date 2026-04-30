-- Create media_cleanup table to track temporary files
CREATE TABLE IF NOT EXISTS public.media_cleanup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_media_cleanup_expires_at ON public.media_cleanup(expires_at);
CREATE INDEX IF NOT EXISTS idx_media_cleanup_user_id ON public.media_cleanup(user_id);

-- Enable RLS
ALTER TABLE public.media_cleanup ENABLE ROW LEVEL SECURITY;

-- Allow only service_role (backend cron/inserts)
-- By default, service_role bypasses RLS, so we just restrict other roles
CREATE POLICY "service_role_only_media_cleanup"
ON public.media_cleanup
FOR ALL
USING (auth.role() = 'service_role');
