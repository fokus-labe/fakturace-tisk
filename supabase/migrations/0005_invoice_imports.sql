-- Sezení I: Audit tabulka pro OCR importy historických faktur
-- Spusti ručně v Supabase SQL Editoru.

CREATE TABLE invoice_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),

  file_count INTEGER NOT NULL,
  invoice_count_created INTEGER NOT NULL,
  invoice_count_failed INTEGER NOT NULL,
  client_count_created INTEGER NOT NULL,

  filenames JSONB,
  errors JSONB,

  total_tokens_input INTEGER,
  total_tokens_output INTEGER,
  estimated_cost_usd NUMERIC(10,4),

  notes TEXT
);

CREATE INDEX idx_invoice_imports_at ON invoice_imports(imported_at DESC);

ALTER TABLE invoice_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON invoice_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
