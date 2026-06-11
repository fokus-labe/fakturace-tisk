-- Sezení O: Rozšíření audit tabulky invoice_imports o typ importu.
-- Rozlišuje OCR importy vydaných faktur (issued) od přijatých faktur (received).
-- Spusti ručně v Supabase SQL Editoru.

ALTER TABLE invoice_imports
ADD COLUMN kind text NOT NULL DEFAULT 'issued'
  CHECK (kind IN ('issued', 'received'));

COMMENT ON COLUMN invoice_imports.kind IS
  'Typ importu: issued = vydané faktury, received = přijaté faktury';

CREATE INDEX idx_invoice_imports_kind ON invoice_imports(kind);
