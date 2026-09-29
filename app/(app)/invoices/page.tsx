import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { calculateInvoiceTotals } from "@/lib/utils/vat";
import { etnExportInfo } from "@/components/etn/etn-export-badge";
import { InvoiceFilters } from "./invoice-filters";
import { InvoicesList, type IssuedListRow } from "./invoices-list";
import { presetToRange, type DatePreset } from "@/lib/date-range/presets";
import type { InvoiceStatus } from "@/types/invoice";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    show_archived?: string;
    preset?: string;
    from?: string;
    to?: string;
    sort_by?: string;
    sort_dir?: string;
  }>;
}

const DATE_PRESETS: DatePreset[] = [
  "all",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "custom",
];

const STATUSES: InvoiceStatus[] = [
  "draft",
  "sent_to_accountant",
  "invoice_issued",
  "archived",
  "cancelled",
];

const DB_SORT_FIELDS = [
  "issued_at",
  "due_date",
  "variable_symbol",
  "status",
  "payment_method",
] as const;

const JS_SORT_FIELDS = ["client_name", "total"] as const;

const ALL_SORT_FIELDS = [...DB_SORT_FIELDS, ...JS_SORT_FIELDS] as string[];

const DEFAULT_SORT_FIELD = "issued_at";
const DEFAULT_SORT_DIR = "asc";

export default async function InvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status && (STATUSES as string[]).includes(sp.status)
    ? (sp.status as InvoiceStatus)
    : undefined;
  const q = sp.q?.trim().toLowerCase();
  const showArchived = sp.show_archived === "1";

  const preset: DatePreset =
    sp.preset && (DATE_PRESETS as string[]).includes(sp.preset)
      ? (sp.preset as DatePreset)
      : "this_year";
  const presetRange = preset === "custom" ? null : presetToRange(preset);
  const from = presetRange ? presetRange.from : (sp.from ?? "");
  const to = presetRange ? presetRange.to : (sp.to ?? "");

  const sortBy = sp.sort_by && ALL_SORT_FIELDS.includes(sp.sort_by)
    ? sp.sort_by
    : DEFAULT_SORT_FIELD;
  const sortDir: "asc" | "desc" =
    sp.sort_dir === "desc" ? "desc" : sp.sort_dir === "asc" ? "asc" : DEFAULT_SORT_DIR;

  const supabase = await createClient();
  const venue = await getActiveVenue();
  let query = supabase
    .from("invoice_requests")
    .select(
      "*, client:clients(name), items:invoice_items(quantity, unit_price_no_vat, vat_rate), etn_export:etn_exports(id, period_start, period_end)",
    )
    .limit(200);

  if (venue) query = query.eq("venue_id", venue.id);
  if (status) query = query.eq("status", status);
  else if (!showArchived) query = query.neq("status", "archived");
  if (from) query = query.gte("issued_at", from);
  if (to) query = query.lte("issued_at", to);

  // DB sort pouze pro přímé sloupce; pro client_name/total se řadí v JS níže
  if ((DB_SORT_FIELDS as readonly string[]).includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortDir === "asc" });
  }
  query = query.order("created_at", { ascending: false });

  const { data } = await query;
  let invoices = data ?? [];
  if (q) {
    invoices = invoices.filter((inv) =>
      (inv.client?.name ?? "").toLowerCase().includes(q),
    );
  }

  let rows: IssuedListRow[] = invoices.map((inv) => {
    const items = (inv.items ?? []).map(
      (it: {
        quantity: number | string;
        unit_price_no_vat: number | string;
        vat_rate: number | string;
      }) => ({
        quantity: Number(it.quantity),
        unit_price_no_vat: Number(it.unit_price_no_vat),
        vat_rate: Number(it.vat_rate),
      }),
    );
    const totals = calculateInvoiceTotals(items);
    return {
      id: inv.id,
      clientName: inv.client?.name ?? "",
      issuedAt: inv.issued_at,
      dueDate: inv.due_date,
      variableSymbol: inv.variable_symbol,
      paymentMethod: inv.payment_method,
      showPayment:
        inv.status === "invoice_issued" || inv.status === "archived",
      totalWithVat: totals.withVat,
      status: inv.status as InvoiceStatus,
      etnExport: etnExportInfo(inv.etn_export),
    };
  });

  if (sortBy === "client_name") {
    const dirMul = sortDir === "asc" ? 1 : -1;
    rows = rows
      .slice()
      .sort(
        (a, b) =>
          dirMul *
          a.clientName.localeCompare(b.clientName, "cs", {
            sensitivity: "base",
          }),
      );
  } else if (sortBy === "total") {
    const dirMul = sortDir === "asc" ? 1 : -1;
    rows = rows.slice().sort((a, b) => dirMul * (a.totalWithVat - b.totalWithVat));
  }

  const selectionKey = [
    venue?.id ?? "",
    status ?? "",
    q ?? "",
    showArchived ? "1" : "0",
    preset,
    from,
    to,
    sortBy,
    sortDir,
  ].join("|");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <VenueBreadcrumb />
          <h1 className="text-2xl sm:text-2xl font-semibold tracking-tight">
            Vydané faktury
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence žádostí o vystavení faktury.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Nová faktura
        </Link>
      </div>

      <InvoiceFilters
        initialStatus={status}
        initialQ={sp.q ?? ""}
        initialShowArchived={showArchived}
        initialPreset={preset}
        initialFrom={from}
        initialTo={to}
        initialSortBy={sortBy}
        initialSortDir={sortDir}
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground p-6 text-center">
              Žádné faktury neodpovídají filtru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <InvoicesList rows={rows} selectionKey={selectionKey} />
      )}
    </div>
  );
}
