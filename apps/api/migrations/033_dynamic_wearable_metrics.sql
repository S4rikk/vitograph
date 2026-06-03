-- Migration 033: Add semantic_metrics column to wearable_manual_metrics
-- This enables storing dynamic, parsed OCR metrics as a Dictionary (Record) for quick queries

ALTER TABLE "wearable_manual_metrics" 
ADD COLUMN IF NOT EXISTS "semantic_metrics" JSONB DEFAULT '{}'::jsonb;
