-- ============================================================================
-- Migrace 0003: ETN exporty (audit) + Storage bucket etn-exports
-- ============================================================================

CREATE TABLE etn_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_by UUID REFERENCES auth.users(id),

  -- Souhrnné statistiky
  invoice_count_received INTEGER NOT NULL DEFAULT 0,
  invoice_count_issued INTEGER NOT NULL DEFAULT 0,
  total_received_with_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_received_no_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_issued_with_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_issued_no_vat NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Audit
  xlsx_url TEXT,                -- aktuální signed URL (může vypršet)
  storage_path TEXT,            -- cesta v bucketu (pro regeneraci signed URL)
  filename TEXT NOT NULL,

  notes TEXT
);

CREATE INDEX idx_etn_exports_period ON etn_exports(period_start, period_end);
CREATE INDEX idx_etn_exports_created ON etn_exports(exported_at DESC);

ALTER TABLE etn_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON etn_exports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket pro ETN exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('etn-exports', 'etn-exports', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "authenticated read etn exports" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'etn-exports');

CREATE POLICY "authenticated write etn exports" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'etn-exports');

CREATE POLICY "authenticated update etn exports" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'etn-exports');

CREATE POLICY "authenticated delete etn exports" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'etn-exports');
