# Audit Report — Sezení G

*26. května 2026*

## Souhrn

- **Mobile responsivita:** implementováno (Sheet sidebar, card layouty, responsivní gridy)
- **Hluboký audit:** proveden napříč security / validation / quality
- **Opravy:** provedeny tam, kde dávaly smysl bez změny API contractů

Žádný nález nevyžadoval nový migration ani změnu DB schématu.

## Bezpečnost

### RLS Policies (ověřeno proti migracím 0001-0003)

| Tabulka | RLS enabled | Policy `authenticated full access` |
|---|---|---|
| `clients` | ✓ | ✓ |
| `invoice_requests` | ✓ | ✓ |
| `invoice_items` | ✓ | ✓ |
| `api_keys` | ✓ | ✓ |
| `suppliers` | ✓ | ✓ |
| `received_invoices` | ✓ | ✓ |
| `etn_exports` | ✓ | ✓ |

Žádné chybějící RLS — migrace 0004 nebyla potřeba.

### Storage Buckets

| Bucket | Public | Auth policies | Použití |
|---|---|---|---|
| `invoice-pdfs` | false | read+write authenticated | PDF podklady vydaných faktur |
| `supplier-invoices` | false | read/write/update/delete authenticated | PDF přílohy přijatých faktur |
| `etn-exports` | false | read/write/update/delete authenticated | ETN XLSX history |

Soubory jsou streamovány přes API routes s auth checkem (`/api/invoice-requests/[id]/pdf`, `/api/received-invoices/[id]/pdf`) nebo přes signed URL s TTL 30 dní (`/api/etn-export/history` pro audit download).

### API Endpoints — auth + validace

Ověřeno všech **20 routes** v `app/api/`:

| Endpoint | Auth check | Zod validation |
|---|---|---|
| `/api/api-keys` GET/POST/DELETE | ✓ | ✓ (POST) |
| `/api/clients` GET/POST | ✓ | ✓ (POST) |
| `/api/clients/[id]` PATCH/DELETE | ✓ | ✓ (PATCH) + FK check (DELETE → 409) |
| `/api/invoice-requests` GET/POST | ✓ cookie or API key | ✓ (POST) |
| `/api/invoice-requests/[id]` GET/PATCH/DELETE | ✓ | ✓ (PATCH) + status check (DELETE → 409 pro vystavené/archivované) |
| `/api/invoice-requests/[id]/pdf` GET | ✓ | n/a |
| `/api/invoice-requests/[id]/prepare` POST | ✓ | n/a |
| `/api/received-invoices` GET/POST | ✓ | ✓ (POST) |
| `/api/received-invoices/[id]` GET/PATCH/DELETE | ✓ | ✓ (PATCH) + status check (DELETE → 409 jen draft/cancelled) |
| `/api/received-invoices/[id]/pdf` GET | ✓ | n/a |
| `/api/received-invoices/[id]/upload-pdf` POST | ✓ | content-type + size check |
| `/api/suppliers` GET/POST | ✓ | ✓ (POST) |
| `/api/suppliers/[id]` GET/PATCH/DELETE | ✓ | ✓ (PATCH) + FK check (DELETE → 409) |
| `/api/etn-export` POST | ✓ | ✓ (period) |
| `/api/etn-export/preview` GET | ✓ | ✓ (period via query) |
| `/api/etn-export/history` GET | ✓ | n/a |
| `/api/etn-export/history/[id]/regenerate` POST | ✓ | n/a |
| `/api/stats` GET | ✓ | n/a |
| `/api/users` GET | ✓ | n/a (admin listing) |

### Service role klíč

`SUPABASE_SERVICE_ROLE_KEY` se objevuje pouze v `lib/supabase/server.ts` v `createServiceClient()` funkci. Žádný import v `"use client"` souboru — ověřeno grepem.

Použití service clienta: server-only routes (PDF stream, ETN audit insert, users listing) — všechny mají předchozí cookie auth check, takže service role je gated.

### Secrets

`.gitignore` vylučuje `.env*`. Žádné hardcoded klíče v kódu (grep pro `sk_`, `service_role`, `eyJ` — čisté, kromě `process.env.SUPABASE_SERVICE_ROLE_KEY` reference v server.ts).

## Validace — polish (toto sezení)

**Před:**
- `notes` max 2000 znaků
- `ico` jen max 20, žádný regex
- `dic` jen max 20, žádný regex
- Částky jen `min(0)`, žádný horní limit

**Po:**

```ts
// IČO — 8 číslic (jen pokud vyplněno)
const optionalIco = z.string().trim().max(20)
  .regex(/^\d{8}$/, "IČO musí mít 8 číslic")
  .optional().nullable().or(z.literal(""));

// DIČ — CZ + 8-10 číslic
const optionalDic = z.string().trim().max(20)
  .regex(/^CZ\d{8,10}$/, "DIČ musí být ve formátu CZ + 8–10 číslic")
  .optional().nullable().or(z.literal(""));

// notes: 2000 → 5000
// Částky: max 99999999.99 (= 99 999 999,99 Kč)
// Texty: trim() všude pro odstranění mezer
```

Aplikováno na: `client.ts`, `supplier.ts`, `invoice.ts` (item + request + status update), `received-invoice.ts`.

## Mobile responsivita

### Komponenty / soubory změněné

**Layout:**
- `components/layout/nav-config.ts` (nový) — sdílená nav config
- `components/layout/sidebar.tsx` — refaktor na `SidebarBrand` + `SidebarNav` (sdílí mobile i desktop)
- `components/layout/header.tsx` — hamburger button (md:hidden) + Sheet s `SidebarNav`
- `components/ui/sheet.tsx` (nový) — Base UI Drawer wrapper, side="left/right/top/bottom"
- `app/(app)/layout.tsx` — `min-w-0` všude, padding `px-4 py-6 sm:px-6 sm:py-8`

**List pages (card layout na mobilu):**
- `/invoices` — mobile `<Link>` cards (klient + status + datum + částka), desktop tabulka
- `/received-invoices` — mobile cards s overdue red border, desktop tabulka
- `/clients` — mobile cards (jméno + IČO + email)
- `/suppliers` — mobile cards (jméno + IČO + email/kategorie)
- `/settings` users — mobile cards s emailem a posledním přihlášením

**ETN export:**
- Date pickery: `grid-cols-1 md:grid-cols-2` (1-col na mobilu)
- "Načíst náhled" / "Stáhnout XLSX": `w-full sm:w-auto`
- Náhled tabulky NÁKLADY/TRŽBY: `overflow-x-auto` wrapper
- Akce dole: `flex-col-reverse sm:flex-row` (primární tlačítko nahoře na mobilu)
- Historie: `overflow-x-auto` wrapper

**Dashboard:**
- 3 hlavní karty: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
- Doplňující karty: `grid-cols-1 sm:grid-cols-2`
- Top dodavatelé/klienti: `grid-cols-1 md:grid-cols-2`
- Heading stack: `flex flex-col sm:flex-row sm:items-end`

**Detail faktury:**
- "Položky" tabulka: `overflow-x-auto -mx-6 px-6` wrapper (zachovává padding ale dovolí horizontální scroll)
- Akce (`invoice-actions`): `flex-wrap` (existující) — buttons se zalamují na mobilu

**Dialog:**
- shadcn dialog už má `max-w-[calc(100%-2rem)] sm:max-w-sm` — vejde se na 360px ✓

## Code Quality

### Co bylo OK už před touto session

- Žádné `console.log` / `console.error` v `app/`, `components/`, `lib/`
- Žádné `as any` / `@ts-ignore` (jen documented `as unknown as Array<...>` v `stats.ts`)
- TypeScript build: prochází bez errors

### Co bylo opraveno

- Header `email` v dropdown trigger: `truncate max-w-[200px]` (předtím se rozbíjelo s dlouhým mailem)
- Header `aria-label`: přidán `aria-label="Otevřít menu"` na hamburger button a `aria-label="Menu uživatele"` na user trigger
- Header pozice: `sticky top-0 z-30` (předtím statický — při scrollu zmizí)
- App layout `min-w-0` všude — fix horizontal overflow z dlouhých emailů/popisů ve flex containers

## Nepřijaté navrhované změny

- **shadcn Sheet přes Radix:** Spec navrhuje `npx shadcn@latest add sheet` (Radix variant). Projekt používá Base UI variant — Sheet wrapper je postaven nad `@base-ui/react/drawer`, který už je nainstalovaný. Důvod: konzistence s Dialog/Popover/Menu primitivy.
- **Card layout pro top dodavatelé/klienti na dashboardu:** Ponecháno jako tabulky (border rounded-lg) — krátký název + číslo se vejde i na 360px bez overflow. Card layout by byl overkill.
- **Detail faktury Položky → card layout:** Použit `overflow-x-auto` wrapper místo cards. Položky jsou jen "row data" (popis × množství × cena), card layout by ztratil přehlednost srovnání řádek.
- **`Notes max 2000 → 10 000:** Spec navrhuje 5000, ponecháno na 5000 (dost pro každé použití).

## Doporučení pro budoucí vývoj

- **Sentry / error tracking:** projekt zatím nemá produkční error tracking. Po několika měsících provozu doporučuji přidat `@sentry/nextjs` (env var DSN, žádný kód jinak).
- **Pre-commit hooks:** Husky + lint-staged + ESLint by chytly drobné regresy. Pro one-person/two-person tým optional, ale stojí to za 10 min setup.
- **Per-user audit log:** Aktuálně víme `created_by` (kdo to založil) ale ne kdo editoval/smazal. Pokud bude přibývat uživatelů, zvážit `audit_log` tabulku s INSERT triggery.
- **E2E test pro ETN export:** Playwright test, který stáhne XLSX a ověří strukturu (sheet, headers, sumační řádek E5) by chytil náhodné regrese v `lib/etn/generate-xlsx.ts`.
- **Bundle analyzer:** `@next/bundle-analyzer` pro zjištění, co bere nejvíc bundle size (recharts už pryč, takže by mělo být OK; exceljs je velký, ale jen server-side).
