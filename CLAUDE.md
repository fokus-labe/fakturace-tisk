# Default workflow pro Claude Code

## Automatický commit + push

Po každém úkolu (po dokončení změn v kódu a úspěšném `npm run build`):

1. Spusť `git status` a podívej se, co je rozjeté
2. Pokud jsou tam JEN soubory relevantní k aktuálnímu úkolu:
   - `git add .`
   - `git commit -m "..."` s krátkou, smysluplnou message podle typu změny
   - `git push`
3. Pokud jsou tam i NEsouvisející soubory (z předchozích sezení):
   - `git add` jen konkrétní cílené soubory
   - `git commit` se zaměřenou message
   - `git push`
4. ZASTAV se a zeptej se uživatele JEN POKUD:
   - Build selhal (build chyby v `npm run build`)
   - Změny jsou destruktivní (mazání důležitých souborů, drop DB tabulek)
   - Není jasné, jaká podmnožina souborů má být commitnutá

**Není potřeba čekat na schválení pro routine commity.** Uživatel dostal hotový 
úkol + push pushnutý na Vercel.

## Commit message konvence

Použij prefix podle typu změny:
- `feat:` — nová feature (např. nová stránka, modul)
- `fix:` — oprava bugu
- `refactor:` — restrukturace bez funkční změny
- `style:` — vizuální polish (CSS, fonty, barvy)
- `chore:` — údržba (deps update, configs)
- `docs:` — dokumentace
- `perf:` — performance optimalizace

Po krátké hlavičce dej prázdný řádek a 3-5 bulletů s konkrétními detaily.

## Vercel auto-deploy

Push na `main` větev → Vercel automaticky rebuilduje → produkce na 
fakturace-tisk.vercel.app aktualizována za ~2 min.

Není potřeba ručně spouštět nic dalšího — Vercel se postará sám.

## Kdy NE-commitovat

- Pokud `npm run build` selhal — oprav build chyby PŘED commitem
- Pokud uživatel řekne "necommituj zatím, chci se nejdřív podívat"
- Pokud změny obsahují credentialy / secrets (klíče, hesla, tokeny)
- Pokud `.env*` soubory by byly commitnuté (musí být v `.gitignore`)

## Migrace

Migrace v `supabase/migrations/0XXX_*.sql` se NESPOUŠTÍ automaticky. Po dokončení 
úkolu, který obsahuje novou migraci:
- Upozorni uživatele jasně: "⚠ Vytvořena nová migrace 0XXX. Spusť ji ručně v 
  Supabase SQL Editoru."
- Commit + push se provede normálně (migrace ide do gitu)
- Uživatel pak migraci spustí v Supabase manuálně

**Pořadí u aditivních migrací (sloupec/tabulka/index navíc):** spusť je na 
PRODUKCI **před** mergem PR. Merge/push do `main` nasazuje produkci okamžitě 
(~2 min přes Vercel), takže kdyby migrace na produkci nebyla, nasazený kód by 
hledal sloupec/tabulku, která tam ještě není, a spadl by. Správné pořadí: 
staging → ověřit → **produkce → teprve pak merge**.

## Lokální test před commitem

Ideálně před commitem spusť `npm run build` — pokud projde, můžeš commitovat.
Pokud build selže, NE-commituj a nahlas chybu uživateli.

## Poznámky k projektu

- **Graf cashflow na dashboardu** (`components/dashboard/cashflow-chart.tsx`) je 
  vlastní SVG komponenta — **recharts se nepoužívá** a není v závislostech (dřívější 
  poznámky, že „recharts byl odstraněn", sedí: v projektu žádný recharts není).