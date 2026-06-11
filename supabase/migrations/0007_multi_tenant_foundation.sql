-- ============================================================
-- 0007: Multi-tenant Foundation (Sezení P1)
-- Přidává venues + user_venues junction + venue_id do všech relevantních tabulek.
-- Backfill všech existujících záznamů → "fokus-tisk".
-- Nahrazuje "authenticated full access" RLS politiky per-venue politikami.
--
-- ⚠ Spusť ručně v Supabase SQL Editoru. PŘED spuštěním udělej DB snapshot
--   (Settings → Database → Backups) — migrace je nevratná.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Venues table
-- ------------------------------------------------------------
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,

  -- Vystavovatel data (per venue, ne globální)
  legal_name text NOT NULL,        -- "Fokus Labe, z. ú."
  ico text NOT NULL,               -- "44226586"
  dic text,                        -- "CZ44226586"
  address_street text,
  address_city text,
  address_zip text,
  address_country text DEFAULT 'Česká republika',

  -- Kontakt
  email text,
  phone text,

  -- Bankovní údaje
  bank_account text,               -- "886879359/0800"
  iban text,                       -- "CZ7708000000000886879359"
  data_box text,                   -- datová schránka "cafk8va"

  -- Branding
  logo_url text,                   -- pro PDF a header
  brand_color text DEFAULT '#2563EB',  -- hex barva pro UI accents

  -- Metadata
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE venues IS 'Provozovny Fokus Labe — multi-tenant';
COMMENT ON COLUMN venues.slug IS 'URL-friendly identifier, např. "fokus-tisk", "piknik-usti"';

-- ------------------------------------------------------------
-- 2. Insert default venues
-- ------------------------------------------------------------
INSERT INTO venues (slug, name, legal_name, ico, dic, address_street, address_city, address_zip, email, phone, bank_account, iban, data_box) VALUES
  ('fokus-tisk', 'Fokus tisk', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', 'Stroupežnického 1372/9', 'Ústí nad Labem-centrum', '400 01', 'fokus@fokuslabe.cz', '+420 732 710 367', '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('chaloupka-usti', 'Chaloupka Ústí', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Ústí nad Labem', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('piknik-usti', 'Piknik Ústí', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Ústí nad Labem', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('piknik-decin', 'Piknik Děčín', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Děčín', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('resslovka', 'Resslovka', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Ústí nad Labem', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('la-buz', 'La Buž', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Ústí nad Labem', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va'),
  ('fokus-catering', 'Fokus Catering', 'Fokus Labe, z. ú.', '44226586', 'CZ44226586', NULL, 'Ústí nad Labem', NULL, NULL, NULL, '886879359/0800', 'CZ7708000000000886879359', 'cafk8va');

-- ------------------------------------------------------------
-- 3. User-venues junction (kdo má přístup k jaké provozovně)
-- ------------------------------------------------------------
CREATE TYPE venue_role AS ENUM ('manager', 'viewer', 'admin');

CREATE TABLE user_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  role venue_role NOT NULL DEFAULT 'manager',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

COMMENT ON TABLE user_venues IS 'Které provozovny vidí který uživatel + jaká role';
COMMENT ON COLUMN user_venues.role IS 'manager = CRUD všech faktur v provozovně, viewer = jen čtení, admin = přístup ke všem provozovnám';

CREATE INDEX idx_user_venues_user ON user_venues(user_id);
CREATE INDEX idx_user_venues_venue ON user_venues(venue_id);

-- ------------------------------------------------------------
-- 4. Přiřadit všechny existující uživatele jako admin ke všem provozovnám
--    (single-user setup — Jakub). Petr se přidá analogicky později.
-- ------------------------------------------------------------
INSERT INTO user_venues (user_id, venue_id, role)
SELECT u.id, v.id, 'admin'::venue_role
FROM auth.users u
CROSS JOIN venues v;

-- ------------------------------------------------------------
-- 5. SECURITY DEFINER helper — zabraňuje nekonečné rekurzi v RLS
--    (politika na user_venues nesmí přímo dotazovat user_venues).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_venue_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_venues
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_venue_admin() IS
  'True pokud má aktuální uživatel roli admin v jakékoli provozovně. SECURITY DEFINER kvůli RLS rekurzi.';

-- ------------------------------------------------------------
-- 6. Přidat venue_id do existujících tabulek (zatím nullable)
-- ------------------------------------------------------------
ALTER TABLE invoice_requests ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE received_invoices ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE clients ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE suppliers ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE etn_exports ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE invoice_imports ADD COLUMN venue_id uuid REFERENCES venues(id);

-- ------------------------------------------------------------
-- 7. Backfill: všechny existující záznamy → Fokus tisk
-- ------------------------------------------------------------
UPDATE invoice_requests SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;
UPDATE received_invoices SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;
UPDATE clients          SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;
UPDATE suppliers        SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;
UPDATE etn_exports      SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;
UPDATE invoice_imports  SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk') WHERE venue_id IS NULL;

-- ------------------------------------------------------------
-- 8. NOT NULL constraint po backfillu
-- ------------------------------------------------------------
ALTER TABLE invoice_requests ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE received_invoices ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE clients          ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE suppliers        ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE etn_exports      ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE invoice_imports  ALTER COLUMN venue_id SET NOT NULL;

-- ------------------------------------------------------------
-- 9. Indexy pro performance
-- ------------------------------------------------------------
CREATE INDEX idx_invoice_requests_venue ON invoice_requests(venue_id);
CREATE INDEX idx_received_invoices_venue ON received_invoices(venue_id);
CREATE INDEX idx_clients_venue ON clients(venue_id);
CREATE INDEX idx_suppliers_venue ON suppliers(venue_id);
CREATE INDEX idx_etn_exports_venue ON etn_exports(venue_id);
CREATE INDEX idx_invoice_imports_venue ON invoice_imports(venue_id);

-- ------------------------------------------------------------
-- 10. RLS pro venues + user_venues
-- ------------------------------------------------------------
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_venues ENABLE ROW LEVEL SECURITY;

-- Authenticated users vidí venues, ke kterým mají přístup (admin vidí vše)
CREATE POLICY "Users see venues they have access to" ON venues FOR SELECT TO authenticated
USING (
  id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- Admins mohou venues spravovat
CREATE POLICY "Admins manage venues" ON venues FOR ALL TO authenticated
USING (public.is_venue_admin())
WITH CHECK (public.is_venue_admin());

-- User_venues — users vidí jen svoje přiřazení
CREATE POLICY "Users see own venue assignments" ON user_venues FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins spravují user_venues (přes SECURITY DEFINER fci → bez rekurze)
CREATE POLICY "Admins manage user_venues" ON user_venues FOR ALL TO authenticated
USING (public.is_venue_admin())
WITH CHECK (public.is_venue_admin());

-- ------------------------------------------------------------
-- 11. Per-venue RLS na existujících tabulkách
--     Nahrazuje původní "authenticated full access" politiky.
-- ------------------------------------------------------------

-- invoice_requests
DROP POLICY IF EXISTS "authenticated full access" ON invoice_requests;
CREATE POLICY "Users see invoices from their venues" ON invoice_requests FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- invoice_items (scoped přes parent invoice_request)
DROP POLICY IF EXISTS "authenticated full access" ON invoice_items;
CREATE POLICY "Users see items from their invoices" ON invoice_items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoice_requests ir
    WHERE ir.id = invoice_items.invoice_request_id
    AND (
      ir.venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
      OR public.is_venue_admin()
    )
  )
);

-- received_invoices
DROP POLICY IF EXISTS "authenticated full access" ON received_invoices;
CREATE POLICY "Users see received from their venues" ON received_invoices FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- clients
DROP POLICY IF EXISTS "authenticated full access" ON clients;
CREATE POLICY "Users see clients from their venues" ON clients FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- suppliers
DROP POLICY IF EXISTS "authenticated full access" ON suppliers;
CREATE POLICY "Users see suppliers from their venues" ON suppliers FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- etn_exports
DROP POLICY IF EXISTS "authenticated full access" ON etn_exports;
CREATE POLICY "Users see ETN from their venues" ON etn_exports FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- invoice_imports
DROP POLICY IF EXISTS "authenticated full access" ON invoice_imports;
CREATE POLICY "Users see imports from their venues" ON invoice_imports FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);

-- ------------------------------------------------------------
-- 12. Trigger pro updated_at na venues
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_venue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_venues_updated_at
BEFORE UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION update_venue_updated_at();
