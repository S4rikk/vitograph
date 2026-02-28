-- SQL Migration for water_logs
CREATE TABLE IF NOT EXISTS public.water_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_glasses INT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Essential index for time-series querying
CREATE INDEX IF NOT EXISTS water_logs_user_id_logged_at_idx ON public.water_logs(user_id, logged_at);
-- RLS Policies
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own water logs" ON public.water_logs FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own water logs" ON public.water_logs FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own water logs" ON public.water_logs FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own water logs" ON public.water_logs FOR DELETE USING (auth.uid() = user_id);