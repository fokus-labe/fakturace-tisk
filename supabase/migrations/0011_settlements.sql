-- ============================================================
-- 0011: Settlements (feat/settlement-import)
-- Doklady, které obsahují zároveň NÁKLAD i TRŽBU (vyúčtování Shoptet Pay,
-- faktura Zásilkovny). Z jednoho dokladu vzniká dvojice: přijatá faktura (náklad)
-- + vydaná faktura (tržba), navázané na settlements řádek. RPC zakládá dvojici
-- v jedné transakci, aby nemohla vzniknout jen půlka.
--
-- ⚠ Spusť ručně v Supabase SQL Editoru — NEJPRVE jen na STAGING databázi.
--   Produkci pustím samostatně až po merge. PŘED spuštěním udělej DB snapshot.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabulka settlements
-- ------------------------------------------------------------
CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id),
  provider text NOT NULL CHECK (provider IN ('shoptet_pay', 'zasilkovna')),
  statement_number text NOT NULL,
  statement_date date NOT NULL,
  gross_amount numeric(12, 2) NOT NULL,
  fee_amount numeric(12, 2) NOT NULL,
  net_amount numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE settlements IS
  'Vyúčtování platebních bran / dopravců (náklad + tržba v jednom dokladu).';

-- Tentýž výpis nelze naimportovat dvakrát (per provozovna).
CREATE UNIQUE INDEX idx_settlements_venue_statement
  ON settlements(venue_id, statement_number);

CREATE INDEX idx_settlements_venue ON settlements(venue_id);

-- ------------------------------------------------------------
-- 2. settlement_id na faktury (obě strany dvojice)
-- ------------------------------------------------------------
ALTER TABLE invoice_requests
  ADD COLUMN settlement_id uuid REFERENCES settlements(id) ON DELETE SET NULL;
ALTER TABLE received_invoices
  ADD COLUMN settlement_id uuid REFERENCES settlements(id) ON DELETE SET NULL;

CREATE INDEX idx_invoice_requests_settlement ON invoice_requests(settlement_id);
CREATE INDEX idx_received_invoices_settlement ON received_invoices(settlement_id);

-- ------------------------------------------------------------
-- 3. RLS — stejný tvar jako ostatní tabulky po 0007
-- ------------------------------------------------------------
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see settlements from their venues" ON settlements FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- ------------------------------------------------------------
-- 4. RPC: založ settlement + náklad + tržbu (+ položku tržby) atomicky.
--    SECURITY INVOKER (default) → RLS dál platí. Když je p_revenue_client_id
--    NULL, tržba nevzniká (např. Zásilkovna s nulovými dobírkami).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_settlement_with_records(
  p_venue_id uuid,
  p_provider text,
  p_statement_number text,
  p_statement_date date,
  p_gross numeric,
  p_fee numeric,
  p_net numeric,
  p_created_by uuid,
  p_short_description text,
  -- náklad (přijatá faktura)
  p_cost_supplier_id uuid,
  p_cost_no_vat numeric,
  p_cost_vat numeric,
  p_cost_total numeric,
  -- tržba (vydaná faktura) — NULL client_id => tržba nevzniká
  p_revenue_client_id uuid,
  p_revenue_no_vat numeric
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_settlement_id uuid;
  v_received_id uuid;
  v_issued_id uuid := NULL;
BEGIN
  INSERT INTO settlements (
    venue_id, provider, statement_number, statement_date,
    gross_amount, fee_amount, net_amount, created_by
  ) VALUES (
    p_venue_id, p_provider, p_statement_number, p_statement_date,
    p_gross, p_fee, p_net, p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Náklad: přijatá faktura, způsob platby faktura, kategorie služby.
  INSERT INTO received_invoices (
    supplier_id, venue_id, settlement_id, supplier_invoice_number,
    issued_at, paid_at, payment_method,
    amount_no_vat, amount_vat, amount_total,
    description, category, status, created_by
  ) VALUES (
    p_cost_supplier_id, p_venue_id, v_settlement_id, p_statement_number,
    p_statement_date, p_statement_date, 'faktura',
    p_cost_no_vat, p_cost_vat, p_cost_total,
    p_short_description, 'sluzby', 'paid', p_created_by
  )
  RETURNING id INTO v_received_id;

  -- Tržba: vydaná faktura ve stavu archived, způsob platby fakturace, sazba 21 %.
  IF p_revenue_client_id IS NOT NULL THEN
    INSERT INTO invoice_requests (
      client_id, venue_id, settlement_id, status,
      issued_at, invoice_issued_at, payment_method,
      short_description, source, created_by
    ) VALUES (
      p_revenue_client_id, p_venue_id, v_settlement_id, 'archived',
      p_statement_date, p_statement_date, 'fakturace',
      p_short_description, 'manual', p_created_by
    )
    RETURNING id INTO v_issued_id;

    INSERT INTO invoice_items (
      invoice_request_id, description, quantity, unit_price_no_vat, vat_rate, order_index
    ) VALUES (
      v_issued_id, p_short_description, 1, p_revenue_no_vat, 21, 0
    );
  END IF;

  RETURN json_build_object(
    'settlement_id', v_settlement_id,
    'received_id', v_received_id,
    'issued_id', v_issued_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_settlement_with_records IS
  'Založí settlements řádek + přijatou (náklad) a vydanou (tržba) fakturu navázané přes settlement_id, v jedné transakci.';
