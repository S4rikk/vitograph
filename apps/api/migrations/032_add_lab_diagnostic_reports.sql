-- Phase 32: Add lab_diagnostic_reports column to profiles
-- Stores JSONB array of GPT-5.2 diagnostic reports generated from lab results.
-- Each entry: { timestamp, biomarkers_count, report: LabDiagnosticReport }
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lab_diagnostic_reports JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN profiles.lab_diagnostic_reports IS 'Array of GPT-5.2 diagnostic reports generated from lab results';