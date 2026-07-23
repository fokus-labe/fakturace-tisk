-- Import fotek: rozlišení počtu FAKTUR od počtu zdrojových SOUBORŮ.
-- Po zavedení seskupování stránek do jedné faktury může být souborů víc než faktur.
-- file_count nově drží počet faktur (dávka), source_file_count počet reálných souborů.
-- Spusti ručně v Supabase SQL Editoru PŘED mergem PR.

ALTER TABLE invoice_imports
ADD COLUMN source_file_count INTEGER;

COMMENT ON COLUMN invoice_imports.source_file_count IS
  'Počet reálných zdrojových souborů importu (fotky/PDF). Může být víc než file_count (faktur) kvůli seskupení víc stran do jedné faktury. NULL u starých importů.';
