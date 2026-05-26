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
import { formatCZK, formatDate } from "@/lib/utils/format";
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Přijaté faktury
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence výdajů od dodavatelů.
          </p>
        </div>
        <Link href="/received-invoices/new" className={cn(buttonVariants())}>
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

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Žádné přijaté faktury neodpovídají filtru.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dodavatel</TableHead>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Částka s DPH</TableHead>
                  <TableHead>Způsob platby</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/received-invoices/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.supplier?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {inv.supplier_invoice_number ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(inv.issued_at)}</TableCell>
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
                    <TableCell className="text-right">
                      {formatCZK(Number(inv.amount_total))}
                    </TableCell>
                    <TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
