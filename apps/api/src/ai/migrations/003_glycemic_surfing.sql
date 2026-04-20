-- ═══════════════════════════════════════════════════════
-- MIGRATION 003: Glycemic Surfing — Insulin Response Data
-- ═══════════════════════════════════════════════════════

-- 1. Расширение meal_items (гликемический профиль каждого продукта)
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS glycemic_index        SMALLINT;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS glycemic_load         REAL;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS insulin_index         SMALLINT;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS response_type         TEXT DEFAULT 'moderate';
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS peak_time_min         SMALLINT;
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS energy_duration_hours REAL;

-- 2. Расширение meal_logs (агрегированный гликемический отклик приёма)
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS glycemic_load_total    REAL;
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS response_type          TEXT;

-- 3. Кэш GI/II для повторяющихся продуктов (общий для всех пользователей)
CREATE TABLE IF NOT EXISTS food_glycemic_cache (
  id                    SERIAL PRIMARY KEY,
  food_name_key         TEXT NOT NULL UNIQUE,
  glycemic_index        SMALLINT NOT NULL,
  insulin_index         SMALLINT,
  response_type         TEXT NOT NULL DEFAULT 'moderate',
  peak_time_min         SMALLINT DEFAULT 30,
  energy_duration_hours REAL DEFAULT 2.0,
  source                TEXT DEFAULT 'llm',
  confidence            REAL DEFAULT 0.7,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_gi_cache_name ON food_glycemic_cache (food_name_key);

-- 4. RLS для food_glycemic_cache
ALTER TABLE food_glycemic_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read glycemic cache" ON food_glycemic_cache
  FOR SELECT USING (true);
CREATE POLICY "Service can insert glycemic cache" ON food_glycemic_cache
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update glycemic cache" ON food_glycemic_cache
  FOR UPDATE USING (true);
CREATE POLICY "Service can delete glycemic cache" ON food_glycemic_cache
  FOR DELETE USING (true);
