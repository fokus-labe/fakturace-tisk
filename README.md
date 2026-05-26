# Fakturace Fokus tisk

Interní systém pro evidenci faktur z provozovny Fokus tisk (Fokus Labe, z. ú.).

## Stack

- **Next.js 16** (App Router)
- **Supabase** — Postgres + Auth + Storage
- **Tailwind v4** + shadcn/ui (Base UI variant)
- **ExcelJS** pro generování ETN exportu
- **Recharts** pro dashboard cashflow graf
- **React Hook Form + Zod** pro validaci formulářů
- Emaily jdou ručně z Gmailu (Resend nepoužíváme)

## Funkce

- Vydané faktury — workflow draft → sent_to_accountant → invoice_issued → archived
- Přijaté faktury — workflow draft → entered → paid → archived
- Dodavatelé a klienti
- ETN Export — XLSX podle šablony Fokus Labe (sekce NÁKLADY / TRŽBY)
- Dashboard cashflow — měsíční přehled, 12měsíční graf, top dodavatelé/klienti

## Lokální vývoj

```bash
npm install
cp .env.local.example .env.local
# Vyplň Supabase klíče v .env.local
npm run dev
```

App běží na http://localhost:3000.

## Environment variables

Potřebné v `.env.local` (lokálně) i ve Vercel projektu:

| Variable | Účel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) klíč |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role klíč (pro API auth) |
| `ACCOUNTANT_EMAIL` | Email Petra Čálka (předvyplnění mailto) |
| `ACCOUNTANT_NAME` | Jméno účetního (v emailu) |
| `NEXT_PUBLIC_APP_URL` | Veřejná URL deploymentu |

## Deployment na Vercel

1. Pushni repo na GitHub (private)
2. Vercel dashboard → **Add New → Project** → vyber repo
3. Framework: **Next.js** (auto-detect)
4. Region: **Frankfurt (fra1)** — nakonfigurováno v `vercel.json`
5. Environment Variables — zkopíruj z `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ACCOUNTANT_EMAIL`
   - `ACCOUNTANT_NAME`
   - `NEXT_PUBLIC_APP_URL` = `https://<deployment>.vercel.app`
6. **Deploy**

Po prvním deployi:

- Supabase → **Authentication → URL Configuration** →
  přidej production URL do **Site URL** a **Redirect URLs**
- `NEXT_PUBLIC_APP_URL` aktualizuj na finální produkční doménu

## Databáze

Migrace jsou v `supabase/migrations/`. Spouští se **ručně** v Supabase SQL Editoru
(v pořadí podle čísla):

- `0001_initial_schema.sql` — clients, invoice_requests, invoice_items, api_keys, storage bucket invoice-pdfs
- `0002_received_invoices_and_suppliers.sql` — suppliers, received_invoices, revize invoice_status (bez `paid`)
- `0003_etn_exports.sql` — etn_exports audit tabulka + bucket etn-exports

## Build

```bash
npm run build
```

Musí projít bez TypeScript chyb. Vercel spustí stejný příkaz při deployi.
