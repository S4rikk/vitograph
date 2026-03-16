-- Migration: fix_meal_schema
-- Description: Add macro and micronutrient columns to meal_logs and meal_items

ALTER TABLE meal_logs 
ADD COLUMN IF NOT EXISTS micronutrients JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_protein DECIMAL(8,2), 
ADD COLUMN IF NOT EXISTS total_fat DECIMAL(8,2), 
ADD COLUMN IF NOT EXISTS total_carbs DECIMAL(8,2);

ALTER TABLE meal_items 
ADD COLUMN IF NOT EXISTS protein_g DECIMAL(7,2), 
ADD COLUMN IF NOT EXISTS fat_g DECIMAL(7,2), 
ADD COLUMN IF NOT EXISTS carbs_g DECIMAL(7,2);
