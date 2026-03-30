ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_goals JSONB DEFAULT '[]'::jsonb;
