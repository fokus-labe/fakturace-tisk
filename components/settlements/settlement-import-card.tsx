"use client";

import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCZK } from "@/lib/utils/format";
import {
  deriveCost,
  deriveRevenue,
  isSettlementSumOk,
  settlementSumDiff,
  SETTLEMENT_PROVIDER_LABELS,
  type SettlementProvider,
} from "@/lib/settlements/compute";

export interface SettlementDraft {
  provider: SettlementProvider;
  statement_number: string;
  statement_date: string;
  gross: number;
  fee: number;
  net: number;
  client_id: string | null;
  client_name: string | null;
}

interface Props {
  filename: string;
  settlement: SettlementDraft;
  approved: boolean;
  clients: { id: string; name: string }[];
  notes?: string | null;
  onChange: (patch: Partial<SettlementDraft>) => void;
  onToggleApproved: () => void;
  onNewClient: () => void;
}

export function SettlementImportCard({
  filename,
  settlement: s,
  approved,
  clients,
  notes,
  onChange,
  onToggleApproved,
  onNewClient,
}: Props) {
  const amounts = { gross: s.gross, fee: s.fee, net: s.net };
  const cost = deriveCost(s.provider, amounts);
  const revenue = deriveRevenue(amounts);
  const sumOk = isSettlementSumOk(amounts);
  const diff = settlementSumDiff(amounts);

  const needsClient = !!revenue && !s.client_id;
  const canApprove = sumOk && !needsClient;

  return (
    <Card
      className={cn(
        "border-2",
        approved
          ? "border-emerald-400"
          : sumOk
            ? "border-blue-300"
            : "border-red-300",
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Vyúčtování · {SETTLEMENT_PROVIDER_LABELS[s.provider]}
            </span>
            <span className="text-sm text-muted-foreground">{filename}</span>
          </span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={approved}
              disabled={!canApprove}
              onChange={onToggleApproved}
              className="size-4"
            />
            <span className="text-xs">Schválit</span>
          </label>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hlavička výpisu */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Číslo výpisu</Label>
            <Input
              value={s.statement_number}
              onChange={(e) => onChange({ statement_number: e.target.value })}
            />
          </div>
          <div>
            <Label>Datum výpisu</Label>
            <Input
              type="date"
              value={s.statement_date}
              onChange={(e) => onChange({ statement_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Brutto / Poplatek / Netto</Label>
            <div className="grid grid-cols-3 gap-1">
              <Input
                type="number"
                step="0.01"
                value={s.gross}
                onChange={(e) => onChange({ gross: Number(e.target.value) })}
                title="Brutto (příchozí platby / vybrané dobírky)"
              />
              <Input
                type="number"
                step="0.01"
                value={s.fee}
                onChange={(e) => onChange({ fee: Number(e.target.value) })}
                title="Poplatek (fakturováno za služby)"
              />
              <Input
                type="number"
                step="0.01"
                value={s.net}
                onChange={(e) => onChange({ net: Number(e.target.value) })}
                title="Netto (bude vyplaceno)"
              />
            </div>
          </div>
        </div>

        {/* Kontrola součtu */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-md p-2 text-sm",
            sumOk
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
          )}
        >
          {sumOk ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 shrink-0" />
          )}
          {sumOk ? (
            <span>
              Součet sedí: brutto {formatCZK(s.gross)} − poplatek{" "}
              {formatCZK(s.fee)} = netto {formatCZK(s.net)}
            </span>
          ) : (
            <span>
              Součet nesedí: nalezeno brutto {formatCZK(s.gross)}, poplatek{" "}
              {formatCZK(s.fee)}, netto {formatCZK(s.net)}. Brutto − poplatek −
              netto = <strong>{formatCZK(diff)}</strong>. Uložení je blokované,
              zkontroluj, jestli OCR sáhlo po správných číslech.
            </span>
          )}
        </div>

        {/* Obě strany dvojice */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              Náklad → přijatá faktura
            </div>
            <div className="text-sm">{cost.supplier.name}</div>
            <div className="text-xs text-muted-foreground">
              služby · faktura
            </div>
            <div className="mt-1 tabular-nums">
              bez DPH {formatCZK(cost.amount_no_vat)} · DPH{" "}
              {formatCZK(cost.amount_vat)} ·{" "}
              <strong>{formatCZK(cost.amount_total)}</strong>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Tržba → vydaná faktura
            </div>
            {revenue ? (
              <>
                <div className="mb-2 tabular-nums text-sm">
                  hrubá {formatCZK(revenue.gross_with_vat)} (21 %) · bez DPH{" "}
                  {formatCZK(revenue.amount_no_vat)}
                </div>
                <Label className="text-xs">Odběratel *</Label>
                <div className="flex gap-2">
                  <Select
                    value={s.client_id ?? ""}
                    onValueChange={(v) => {
                      const c = clients.find((x) => x.id === v);
                      onChange({
                        client_id: v || null,
                        client_name: c?.name ?? null,
                      });
                    }}
                  >
                    <SelectTrigger
                      className={cn(needsClient && "border-red-400")}
                    >
                      <SelectValue placeholder="Vyber odběratele…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onNewClient}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {needsClient ? (
                  <p className="mt-1 text-xs text-red-600">
                    Odběratele nelze z dokladu vyčíst — vyber ho.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nulové dobírky → tržba nevzniká, založí se jen náklad.
              </div>
            )}
          </div>
        </div>

        {notes ? (
          <p className="text-xs italic text-amber-700 dark:text-amber-300">
            Poznámka AI: {notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
