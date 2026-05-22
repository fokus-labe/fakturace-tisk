-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Klienti (odběratelé)
CREATE TABLE clients (
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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_name ON clients USING gin(to_tsvector('simple', name));
CREATE INDEX idx_clients_ico ON clients(ico);

-- Status enum
CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent_to_accountant',
  'invoice_issued',
  'paid',
  'archived',
  'cancelled'
);

CREATE TYPE invoice_source AS ENUM ('manual', 'eshop_api');

-- Žádosti o vystavení faktury (NE faktury samotné!)
CREATE TABLE invoice_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status invoice_status NOT NULL DEFAULT 'draft',

  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  variable_symbol TEXT,
  payment_method TEXT DEFAULT 'převodem',

  notes TEXT,
  pdf_url TEXT,
  external_invoice_number TEXT,

  source invoice_source NOT NULL DEFAULT 'manual',
  source_reference TEXT,
  source_metadata JSONB,

  email_sent_at TIMESTAMPTZ,
  accountant_notified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_requests_status ON invoice_requests(status);
CREATE INDEX idx_invoice_requests_client ON invoice_requests(client_id);
CREATE INDEX idx_invoice_requests_created ON invoice_requests(created_at DESC);
CREATE INDEX idx_invoice_requests_source ON invoice_requests(source, source_reference);

-- Položky faktury
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_request_id UUID NOT NULL REFERENCES invoice_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_no_vat NUMERIC(12,2) NOT NULL,
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 21,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_request ON invoice_items(invoice_request_id);

-- API klíče pro e-shopy
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invoice_requests_updated_at
  BEFORE UPDATE ON invoice_requests FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policies: přihlášení uživatelé mohou vše (single-tenant pro Fokus tisk)
CREATE POLICY "authenticated full access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON invoice_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON api_keys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket pro PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "authenticated read pdfs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'invoice-pdfs');

CREATE POLICY "authenticated write pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoice-pdfs');
