-- ============================================================
-- 0009: API keys venue scope (fix/venue-isolation)
-- Doplňuje venue_id do api_keys (jediná datová tabulka, kterou 0007 vynechala).
-- Backfill existujících klíčů → "fokus-tisk", pak NOT NULL + index.
-- Nahrazuje single-tenant "authenticated full access" per-venue politikou
-- stejného tvaru jako 0007 na ostatních tabulkách.
--
-- ⚠ Spusť ručně v Supabase SQL Editoru — NEJPRVE jen na STAGING databázi.
--   Produkci pustíme samostatně až po merge. PŘED spuštěním udělej DB snapshot.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Přidat venue_id (zatím nullable kvůli backfillu)
-- ------------------------------------------------------------
ALTER TABLE api_keys ADD COLUMN venue_id uuid REFERENCES venues(id);

-- ------------------------------------------------------------
-- 2. Backfill existujících klíčů → Fokus tisk
-- ------------------------------------------------------------
UPDATE api_keys
SET venue_id = (SELECT id FROM venues WHERE slug = 'fokus-tisk')
WHERE venue_id IS NULL;

-- ------------------------------------------------------------
-- 3. NOT NULL constraint po backfillu
-- ------------------------------------------------------------
ALTER TABLE api_keys ALTER COLUMN venue_id SET NOT NULL;

-- ------------------------------------------------------------
-- 4. Index pro performance
-- ------------------------------------------------------------
CREATE INDEX idx_api_keys_venue ON api_keys(venue_id);

-- ------------------------------------------------------------
-- 5. Per-venue RLS — nahrazuje původní "authenticated full access"
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated full access" ON api_keys;
CREATE POLICY "Users see api keys from their venues" ON api_keys FOR ALL TO authenticated
USING (
  venue_id IN (SELECT venue_id FROM user_venues WHERE user_id = auth.uid())
  OR public.is_venue_admin()
);
