-- Add micronutrients JSONB column to meal_logs table
ALTER TABLE meal_logs
ADD COLUMN micronutrients JSONB DEFAULT '{}'::jsonb NOT NULL;
-- Add a comment to the column for documentation
COMMENT ON COLUMN meal_logs.micronutrients IS 'Aggregated micronutrients (vitamins, minerals) for the meal, stored as key-value pairs where key is the nutrient name and value is the amount in appropriate units.';