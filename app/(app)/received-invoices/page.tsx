import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { formatDateInput } from "@/lib/utils/format";
import { etnExportInfo } from "@/components/etn/etn-export-badge";
import { ReceivedInvoiceFilters } from "./received-invoice-filters";
import {
  ReceivedInvoicesList,
  type ReceivedListRow,
} from "./received-invoices-list";
import { presetToRange, type DatePreset } from "@/lib/date-range/presets";
import {
  type ReceivedInvoiceCategory,
  type ReceivedInvoiceStatus,
  type ReceivedPaymentMethod,
} from "@/types/received-invoice";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    category?: string;
    q?: string;
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
  "this_and_last_month",
  "this_year",
  "last_year",
  "custom",
];

// Výchozí pohled přijatých faktur: tento a minulý měsíc (přechod přes hranu měsíce).
const DEFAULT_DATE_PRESET: DatePreset = "this_and_last_month";

const STATUSES: ReceivedInvoiceStatus[] = [
  "draft",
  "entered",
  "paid",
  "archived",
  "cancelled",
];

const CATEGORIES: ReceivedInvoiceCategory[] = [
  "material",
  "textil",
  "reklamni_predmety",
  "sluzby",
  "potisk",
  "obaly",
  "ostatni",
];

const DB_SORT_FIELDS = [
  "issued_at",
  "due_date",
  "amount_total",
  "category",
  "status",
  "payment_method",
  "supplier_invoice_number",
] as const;

const JS_SORT_FIELDS = ["supplier_name"] as const;

const ALL_SORT_FIELDS = [...DB_SORT_FIELDS, ...JS_SORT_FIELDS] as string[];

const DEFAULT_SORT_FIELD = "issued_at";
const DEFAULT_SORT_DIR = "asc";

export default async function ReceivedInvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status =
    sp.status && (STATUSES as string[]).includes(sp.status)
      ? (sp.status as ReceivedInvoiceStatus)
      : undefined;
  const category =
    sp.category && (CATEGORIES as string[]).includes(sp.category)
      ? (sp.category as ReceivedInvoiceCategory)
      : undefined;
  const q = sp.q?.trim().toLowerCase();

  const preset: DatePreset =
    sp.preset && (DATE_PRESETS as string[]).includes(sp.preset)
      ? (sp.preset as DatePreset)
      : DEFAULT_DATE_PRESET;
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
    .from("received_invoices")
    .select(
      "*, supplier:suppliers(id, name), etn_export:etn_exports(id, period_start, period_end)",
    )
    .limit(300);
  if (venue) query = query.eq("venue_id", venue.id);
  // Archivované jsou z výchozího pohledu skryté; zobrazí se jen když si uživatel
  // explicitně vybere status „Archiv" (parametr status v URL přebije default).
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "archived");
  if (category) query = query.eq("category", category);
  if (from) query = query.gte("issued_at", from);
  if (to) query = query.lte("issued_at", to);

  if ((DB_SORT_FIELDS as readonly string[]).includes(sortBy)) {
    query = query.order(sortBy, { ascending: sortDir === "asc" });
  }
  query = query.order("created_at", { ascending: false });

  const { data } = await query;
  let invoices = data ?? [];
  if (q) {
    invoices = invoices.filter(
      (inv) =>
        (inv.supplier?.name ?? "").toLowerCase().includes(q) ||
        (inv.description ?? "").toLowerCase().includes(q),
    );
  }

  const today = formatDateInput(new Date());
  let rows: ReceivedListRow[] = invoices.map((inv) => {
    const overdue =
      !!inv.due_date &&
      inv.due_date < today &&
      inv.status !== "paid" &&
      inv.status !== "archived" &&
      inv.status !== "cancelled";
    return {
      id: inv.id,
      supplierName: inv.supplier?.name ?? "",
      supplierInvoiceNumber: inv.supplier_invoice_number,
      issuedAt: inv.issued_at,
      dueDate: inv.due_date,
      description: inv.description ?? "",
      category: inv.category as ReceivedInvoiceCategory,
      amountTotal: Number(inv.amount_total),
      paymentMethod: inv.payment_method as ReceivedPaymentMethod,
      status: inv.status as ReceivedInvoiceStatus,
      overdue,
      etnExport: etnExportInfo(inv.etn_export),
    };
  });

  if (sortBy === "supplier_name") {
    const dirMul = sortDir === "asc" ? 1 : -1;
    rows = rows
      .slice()
      .sort(
        (a, b) =>
          dirMul *
          a.supplierName.localeCompare(b.supplierName, "cs", {
            sensitivity: "base",
          }),
      );
  }

  const selectionKey = [
    venue?.id ?? "",
    status ?? "",
    category ?? "",
    q ?? "",
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Přijaté faktury
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence výdajů od dodavatelů.
          </p>
        </div>
        <Link
          href="/received-invoices/new"
          className={cn(buttonVariants(), "w-full sm:w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Nová přijatá faktura
        </Link>
      </div>

      <ReceivedInvoiceFilters
        initialStatus={status}
        initialCategory={category}
        initialQ={sp.q ?? ""}
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
              Žádné přijaté faktury neodpovídají filtru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReceivedInvoicesList rows={rows} selectionKey={selectionKey} />
      )}
    </div>
  );
}
