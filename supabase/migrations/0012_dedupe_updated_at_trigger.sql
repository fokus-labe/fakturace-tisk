-- ============================================================
-- 0012: Deduplikace updated_at trigger funkce (chore/cleanup)
-- update_venue_updated_at (0007) je prakticky shodná s update_updated_at (0001)
-- — obě jen nastavují NEW.updated_at = now(). Přesměrujeme VŠECHNY triggery
-- z update_venue_updated_at na update_updated_at a teprve pak druhou funkci
-- zahodíme (aby na mazané funkci nezůstal viset žádný trigger).
--
-- ⚠ Spusť ručně v Supabase SQL Editoru — NEJPRVE jen na STAGING databázi.
--   Produkci pustím samostatně před merge. PŘED spuštěním udělej DB snapshot.
-- ============================================================

-- ------------------------------------------------------------
-- 1. (informativní) Na kterých tabulkách visí triggery používající
--    update_venue_updated_at — pro kontrolu před spuštěním:
--
--    SELECT t.tgname, c.relname AS table_name
--    FROM pg_trigger t
--    JOIN pg_class c ON c.oid = t.tgrelid
--    WHERE t.tgfoid = 'public.update_venue_updated_at'::regproc
--      AND NOT t.tgisinternal;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 2. Přepiš VŠECHNY takové triggery na update_updated_at.
--    Dynamicky projde všechny triggery svázané s update_venue_updated_at,
--    ať nezůstane žádný (ne jen ten, o kterém víme — venues). Jde výhradně
--    o updated_at triggery (BEFORE UPDATE FOR EACH ROW).
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgfoid = 'public.update_venue_updated_at'::regproc
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.relname);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      r.tgname, r.relname
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Teprve teď je bezpečné duplicitní funkci zahodit.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_venue_updated_at();
