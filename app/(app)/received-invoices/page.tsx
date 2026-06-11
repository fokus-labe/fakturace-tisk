import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getActiveVenue } from "@/lib/venues/get-user-venues";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";
import { formatCZK, formatDate, formatDateInput } from "@/lib/utils/format";
import { ReceivedInvoiceStatusBadge } from "@/components/received-invoice/received-invoice-status-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SortSelect } from "@/components/ui/sort-select";
import { ReceivedInvoiceFilters } from "./received-invoice-filters";
import { presetToRange, type DatePreset } from "@/lib/date-range/presets";
import {
  RECEIVED_INVOICE_CATEGORY_LABELS,
  RECEIVED_PAYMENT_METHOD_LABELS,
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
  "this_year",
  "last_year",
  "custom",
];

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

const MOBILE_SORT_OPTIONS = [
  { value: "issued_at|asc", label: "Datum (nejstarší)" },
  { value: "issued_at|desc", label: "Datum (nejnovější)" },
  { value: "supplier_name|asc", label: "Dodavatel (A–Z)" },
  { value: "supplier_name|desc", label: "Dodavatel (Z–A)" },
  { value: "amount_total|desc", label: "Částka (od nejvyšší)" },
  { value: "amount_total|asc", label: "Částka (od nejnižší)" },
  { value: "due_date|asc", label: "Splatnost (nejstarší)" },
];

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
    .from("received_invoices")
    .select("*, supplier:suppliers(id, name)")
    .limit(300);
  if (venue) query = query.eq("venue_id", venue.id);
  if (status) query = query.eq("status", status);
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
  let enriched = invoices.map((inv) => {
    const overdue =
      !!inv.due_date &&
      inv.due_date < today &&
      inv.status !== "paid" &&
      inv.status !== "archived" &&
      inv.status !== "cancelled";
    return { inv, overdue };
  });

  if (sortBy === "supplier_name") {
    const dirMul = sortDir === "asc" ? 1 : -1;
    enriched = enriched
      .slice()
      .sort(
        (a, b) =>
          dirMul *
          (a.inv.supplier?.name ?? "").localeCompare(
            b.inv.supplier?.name ?? "",
            "cs",
            { sensitivity: "base" },
          ),
      );
  }

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

      {enriched.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground p-6 text-center">
              Žádné přijaté faktury neodpovídají filtru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: sort dropdown + card list */}
          <div className="md:hidden space-y-2">
            <SortSelect
              options={MOBILE_SORT_OPTIONS}
              defaultField={DEFAULT_SORT_FIELD}
              defaultDir={DEFAULT_SORT_DIR}
            />
            {enriched.map(({ inv, overdue }) => (
              <Link
                key={inv.id}
                href={`/received-invoices/${inv.id}`}
                className={cn(
                  "block rounded-lg border bg-card p-4 transition-colors active:bg-muted/30",
                  overdue && "border-red-300 bg-red-50/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {inv.supplier?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {inv.description}
                    </p>
                  </div>
                  <ReceivedInvoiceStatusBadge status={inv.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex flex-col text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(inv.issued_at)}
                    </span>
                    {inv.due_date ? (
                      <span
                        className={cn(
                          "tabular-nums",
                          overdue
                            ? "text-red-700 font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        splatnost {formatDate(inv.due_date)}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono tabular-nums font-medium">
                    {formatCZK(Number(inv.amount_total))}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader field="supplier_name" label="Dodavatel" />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      field="supplier_invoice_number"
                      label="Číslo"
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="issued_at" label="Datum" />
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="due_date" label="Splatnost" />
                  </TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>
                    <SortableHeader field="category" label="Kategorie" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader
                      field="amount_total"
                      label="Částka s DPH"
                      align="right"
                      defaultDir="desc"
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      field="payment_method"
                      label="Způsob platby"
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="status" label="Status" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map(({ inv, overdue }) => (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      overdue && "bg-red-50/60 hover:bg-red-50",
                    )}
                  >
                    <TableCell>
                      <Link
                        href={`/received-invoices/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.supplier?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv.supplier_invoice_number ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(inv.issued_at)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        overdue && "text-red-700 font-medium",
                      )}
                    >
                      {formatDate(inv.due_date)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {inv.description}
                    </TableCell>
                    <TableCell>
                      {
                        RECEIVED_INVOICE_CATEGORY_LABELS[
                          inv.category as ReceivedInvoiceCategory
                        ]
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCZK(Number(inv.amount_total))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {
                        RECEIVED_PAYMENT_METHOD_LABELS[
                          inv.payment_method as ReceivedPaymentMethod
                        ]
                      }
                    </TableCell>
                    <TableCell>
                      <ReceivedInvoiceStatusBadge status={inv.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}
