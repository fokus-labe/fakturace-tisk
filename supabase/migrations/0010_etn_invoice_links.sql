-- ============================================================
-- 0010: ETN ↔ invoice links (feat/etn-selection)
-- Přidává etn_export_id do invoice_requests + received_invoices, aby ETN export
-- měl paměť o tom, co už bylo odevzdané (řeší duplicity a propadlé faktury).
-- Backfill historických exportů (při překryvu období vyhrává STARŠÍ export).
-- Přidává RPC, která vytvoří etn_exports řádek a naváže faktury v JEDNÉ transakci.
--
-- ⚠ Spusť ručně v Supabase SQL Editoru — NEJPRVE jen na STAGING databázi.
--   Produkci pustím samostatně až po merge. PŘED spuštěním udělej DB snapshot.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Sloupce etn_export_id (nullable, ON DELETE SET NULL)
-- ------------------------------------------------------------
ALTER TABLE invoice_requests
  ADD COLUMN etn_export_id uuid REFERENCES etn_exports(id) ON DELETE SET NULL;
ALTER TABLE received_invoices
  ADD COLUMN etn_export_id uuid REFERENCES etn_exports(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2. Indexy
-- ------------------------------------------------------------
CREATE INDEX idx_invoice_requests_etn_export ON invoice_requests(etn_export_id);
CREATE INDEX idx_received_invoices_etn_export ON received_invoices(etn_export_id);

-- ------------------------------------------------------------
-- 3. Backfill historických dat
--    Pro každou fakturu přiřaď nejstarší export téže provozovny, jehož období
--    pokrývá efektivní datum faktury. Efektivní datum vydaných = invoice_issued_at
--    || issued_at (stejně jako lib/etn/fetch-period-data.ts), status invoice_issued
--    nebo archived. Přijaté: vše kromě cancelled, efektivní datum = issued_at.
--    Překryv období → vyhrává starší export (ORDER BY period_start, exported_at).
-- ------------------------------------------------------------
UPDATE invoice_requests ir
SET etn_export_id = (
  SELECT ex.id FROM etn_exports ex
  WHERE ex.venue_id = ir.venue_id
    AND COALESCE(ir.invoice_issued_at, ir.issued_at) BETWEEN ex.period_start AND ex.period_end
  ORDER BY ex.period_start ASC, ex.exported_at ASC
  LIMIT 1
)
WHERE ir.etn_export_id IS NULL
  AND ir.status IN ('invoice_issued', 'archived')
  AND EXISTS (
    SELECT 1 FROM etn_exports ex2
    WHERE ex2.venue_id = ir.venue_id
      AND COALESCE(ir.invoice_issued_at, ir.issued_at) BETWEEN ex2.period_start AND ex2.period_end
  );

UPDATE received_invoices ri
SET etn_export_id = (
  SELECT ex.id FROM etn_exports ex
  WHERE ex.venue_id = ri.venue_id
    AND ri.issued_at BETWEEN ex.period_start AND ex.period_end
  ORDER BY ex.period_start ASC, ex.exported_at ASC
  LIMIT 1
)
WHERE ri.etn_export_id IS NULL
  AND ri.status <> 'cancelled'
  AND EXISTS (
    SELECT 1 FROM etn_exports ex2
    WHERE ex2.venue_id = ri.venue_id
      AND ri.issued_at BETWEEN ex2.period_start AND ex2.period_end
  );

-- ------------------------------------------------------------
-- 4. RPC: vytvoř export + naváž faktury atomicky (jedna transakce).
--    Běží jako SECURITY INVOKER (default) → RLS dál platí, uživatel může
--    navázat jen faktury vlastní provozovny. Vrací id nového exportu.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_etn_export_with_links(
  p_venue_id uuid,
  p_period_start date,
  p_period_end date,
  p_exported_by uuid,
  p_invoice_count_received integer,
  p_invoice_count_issued integer,
  p_total_received_with_vat numeric,
  p_total_received_no_vat numeric,
  p_total_issued_with_vat numeric,
  p_total_issued_no_vat numeric,
  p_xlsx_url text,
  p_storage_path text,
  p_filename text,
  p_issued_ids uuid[],
  p_received_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_export_id uuid;
BEGIN
  INSERT INTO etn_exports (
    venue_id, period_start, period_end, exported_by,
    invoice_count_received, invoice_count_issued,
    total_received_with_vat, total_received_no_vat,
    total_issued_with_vat, total_issued_no_vat,
    xlsx_url, storage_path, filename
  ) VALUES (
    p_venue_id, p_period_start, p_period_end, p_exported_by,
    p_invoice_count_received, p_invoice_count_issued,
    p_total_received_with_vat, p_total_received_no_vat,
    p_total_issued_with_vat, p_total_issued_no_vat,
    p_xlsx_url, p_storage_path, p_filename
  )
  RETURNING id INTO v_export_id;

  IF array_length(p_issued_ids, 1) > 0 THEN
    UPDATE invoice_requests
    SET etn_export_id = v_export_id
    WHERE venue_id = p_venue_id AND id = ANY(p_issued_ids);
  END IF;

  IF array_length(p_received_ids, 1) > 0 THEN
    UPDATE received_invoices
    SET etn_export_id = v_export_id
    WHERE venue_id = p_venue_id AND id = ANY(p_received_ids);
  END IF;

  RETURN v_export_id;
END;
$$;

COMMENT ON FUNCTION public.create_etn_export_with_links IS
  'Vytvoří etn_exports řádek a naváže vydané/přijaté faktury (etn_export_id) atomicky.';
