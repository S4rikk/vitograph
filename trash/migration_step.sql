ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS lifestyle_markers JSONB DEFAULT '{}'::jsonb;