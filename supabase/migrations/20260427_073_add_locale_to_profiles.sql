-- Phase 1: Add locale column to profiles
-- Stores the user's preferred UI language (ISO 639-1 code)
-- Default 'ru' for backward compatibility with existing users
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'ru';

-- Notify PostgREST to pick up schema change
NOTIFY pgrst, 'reload schema';
