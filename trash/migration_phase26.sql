CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    meal_type TEXT,
    total_calories NUMERIC(8, 1) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_log_id UUID NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,
    weight_g NUMERIC(8, 1) NOT NULL,
    calories NUMERIC(8, 1) DEFAULT 0,
    protein_g NUMERIC(8, 1) DEFAULT 0,
    fat_g NUMERIC(8, 1) DEFAULT 0,
    carbs_g NUMERIC(8, 1) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);