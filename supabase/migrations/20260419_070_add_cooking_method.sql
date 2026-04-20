-- ═══════════════════════════════════════════════════════
-- MIGRATION 070: Cooking Method for GI Accuracy
-- ═══════════════════════════════════════════════════════

-- Способ приготовления влияет на GI (варёный картофель 78 vs жареный 95)
ALTER TABLE meal_items ADD COLUMN IF NOT EXISTS cooking_method TEXT;
