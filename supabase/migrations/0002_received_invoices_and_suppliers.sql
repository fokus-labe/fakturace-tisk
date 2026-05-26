-- ============================================================================
-- Migrace 0002: Přijaté faktury + Dodavatelé + revize statusů vydaných faktur
-- ============================================================================
--
-- ČÁST 1: Revize statusů vydaných faktur (invoice_requests)
-- ČÁST 2: Nová pole na vydaných fakturách
-- ČÁST 3: Tabulka suppliers (dodavatelé)
-- ČÁST 4: Tabulka received_invoices (přijaté faktury) + číselníky
-- ČÁST 5: Storage bucket supplier-invoices
-- ============================================================================


-- ============================================================================
-- ČÁST 1: Status enum vydaných faktur — odstranění 'paid'
-- ============================================================================
-- Jakub nemá přístup k bankovnímu výpisu, proto u VYDANÝCH faktur status 'paid'
-- nedává smysl. Workflow končí 'invoice_issued' → 'archived'.
-- Existující záznamy se statusem 'paid' převedeme na 'archived'.

-- 1.1 Vytvoříme nový enum bez 'paid'
CREATE TYPE invoice_status_new AS ENUM (
  'draft',
  'sent_to_accountant',
  'invoice_issued',
  'archived',
  'cancelled'
);

-- 1.2 Drop default tak, aby ALTER COLUMN nepadl
ALTER TABLE invoice_requests ALTER COLUMN status DROP DEFAULT;

-- 1.3 Převedeme sloupec na nový enum, přičemž 'paid' → 'archived'
ALTER TABLE invoice_requests
  ALTER COLUMN status TYPE invoice_status_new
  USING (
    CASE status::text
      WHEN 'paid' THEN 'archived'
      ELSE status::text
    END
  )::invoice_status_new;

-- 1.4 Vrátíme default
ALTER TABLE invoice_requests ALTER COLUMN status SET DEFAULT 'draft';

-- 1.5 Smažeme starý enum a přejmenujeme nový
DROP TYPE invoice_status;
ALTER TYPE invoice_status_new RENAME TO invoice_status;


-- ============================================================================
-- ČÁST 2: Nová pole na invoice_requests
-- ============================================================================

-- 2.1 invoice_issued_at — datum, kdy Petr fakturu vystavil v účetním softwaru.
--     issued_at zůstává jako datum vytvoření podkladu Jakubem.
ALTER TABLE invoice_requests
  ADD COLUMN IF NOT EXISTS invoice_issued_at DATE;

-- 2.2 payment_method — pro ETN report. Zatím TEXT (ne enum), aby šly přidávat
--     hodnoty bez migrace. Default 'fakturace'.
--     Sloupec payment_method již existuje (z 0001) jako TEXT DEFAULT 'převodem'.
--     Změníme default a převedeme stávající 'převodem' na 'fakturace'.
UPDATE invoice_requests SET payment_method = 'fakturace'
  WHERE payment_method IS NULL OR payment_method = 'převodem';

ALTER TABLE invoice_requests
  ALTER COLUMN payment_method SET DEFAULT 'fakturace',
  ALTER COLUMN payment_method SET NOT NULL;

-- 2.3 short_description — krátký popis pro ETN export (např. "FA 260100079")
ALTER TABLE invoice_requests
  ADD COLUMN IF NOT EXISTS short_description TEXT;


-- ============================================================================
-- ČÁST 3: Tabulka suppliers (dodavatelé)
-- ============================================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  ico TEXT,
  dic TEXT,
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'Česká republika',
  email TEXT,
  phone TEXT,
  notes TEXT,
  default_payment_method TEXT,
  default_category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers USING gin(to_tsvector('simple', name));
CREATE INDEX idx_suppliers_ico ON suppliers(ico);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- ČÁST 4: Tabulka received_invoices + číselníky
-- ============================================================================

CREATE TYPE received_invoice_category AS ENUM (
  'material',
  'textil',
  'reklamni_predmety',
  'sluzby',
  'potisk',
  'obaly',
  'ostatni'
);

CREATE TYPE received_invoice_status AS ENUM (
  'draft',
  'entered',
  'paid',
  'archived',
  'cancelled'
);

CREATE TYPE received_payment_method AS ENUM (
  'faktura',
  'hotovost',
  'dodaci_list',
  'dobirka'
);

CREATE TABLE received_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  supplier_invoice_number TEXT,
  issued_at DATE NOT NULL,
  due_date DATE,
  paid_at DATE,

  payment_method received_payment_method NOT NULL DEFAULT 'faktura',

  amount_no_vat NUMERIC(12,2) NOT NULL,
  amount_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_total NUMERIC(12,2) NOT NULL,

  description TEXT NOT NULL,
  category received_invoice_category NOT NULL DEFAULT 'ostatni',

  pdf_url TEXT,
  status received_invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_received_invoices_supplier ON received_invoices(supplier_id);
CREATE INDEX idx_received_invoices_status ON received_invoices(status);
CREATE INDEX idx_received_invoices_issued ON received_invoices(issued_at DESC);
CREATE INDEX idx_received_invoices_category ON received_invoices(category);

CREATE TRIGGER trg_received_invoices_updated_at
  BEFORE UPDATE ON received_invoices FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE received_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON received_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- ČÁST 5: Storage bucket supplier-invoices
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-invoices', 'supplier-invoices', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "authenticated read supplier pdfs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'supplier-invoices');

CREATE POLICY "authenticated write supplier pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supplier-invoices');

CREATE POLICY "authenticated update supplier pdfs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'supplier-invoices');

CREATE POLICY "authenticated delete supplier pdfs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'supplier-invoices');
