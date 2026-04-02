-- ============================================
-- lab_scans: Async OCR job tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS lab_scans (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    file_count  integer NOT NULL DEFAULT 0,
    result      jsonb,
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lab_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lab_scans_updated_at
    BEFORE UPDATE ON lab_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_scans_updated_at();

-- RLS
ALTER TABLE lab_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lab scans"
    ON lab_scans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own lab scans"
    ON lab_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own lab scans"
    ON lab_scans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_lab_scans_user_id ON lab_scans(user_id);
CREATE INDEX idx_lab_scans_status ON lab_scans(status) WHERE status IN ('PENDING', 'PROCESSING');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lab_scans;
