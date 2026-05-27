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
import { formatCZK, formatDate, formatDateInput } from "@/lib/utils/format";
import { ReceivedInvoiceStatusBadge } from "@/components/received-invoice/received-invoice-status-badge";
import { ReceivedInvoiceFilters } from "./received-invoice-filters";
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
    from?: string;
    to?: string;
  }>;
}

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

  const supabase = await createClient();
  let query = supabase
    .from("received_invoices")
    .select("*, supplier:suppliers(id, name)")
    .order("issued_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (sp.from) query = query.gte("issued_at", sp.from);
  if (sp.to) query = query.lte("issued_at", sp.to);

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
  const enriched = invoices.map((inv) => {
    const overdue =
      !!inv.due_date &&
      inv.due_date < today &&
      inv.status !== "paid" &&
      inv.status !== "archived" &&
      inv.status !== "cancelled";
    return { inv, overdue };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
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
        initialFrom={sp.from ?? ""}
        initialTo={sp.to ?? ""}
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
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
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
                  <TableHead>Dodavatel</TableHead>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Splatnost</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Částka s DPH</TableHead>
                  <TableHead>Způsob platby</TableHead>
                  <TableHead>Status</TableHead>
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
