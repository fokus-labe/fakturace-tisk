"use client";

import { useState } from "react";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCZK } from "@/lib/utils/format";

interface CashflowPoint {
  month: string;
  received_with_vat: number;
  received_no_vat: number;
  issued_with_vat: number;
  issued_no_vat: number;
}

interface Props {
  data: CashflowPoint[];
}

const CZ_MONTHS = [
  "Led",
  "Úno",
  "Bře",
  "Dub",
  "Kvě",
  "Čvn",
  "Čvc",
  "Srp",
  "Zář",
  "Říj",
  "Lis",
  "Pro",
];

function formatMonth(key: string): string {
  const [, m] = key.split("-");
  const idx = Number(m) - 1;
  return CZ_MONTHS[idx] ?? key;
}

function formatAxisCZK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export function CashflowChart({ data }: Props) {
  const [withVat, setWithVat] = useState(true);

  const chartData = data.map((d) => ({
    label: formatMonth(d.month),
    Příjmy: withVat ? d.issued_with_vat : d.issued_no_vat,
    Výdaje: withVat ? d.received_with_vat : d.received_no_vat,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Cashflow 12 měsíců</CardTitle>
        <div className="flex rounded-md border bg-muted/30 p-0.5 text-xs">
          <Button
            type="button"
            variant={withVat ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 px-2.5", withVat && "shadow-sm")}
            onClick={() => setWithVat(true)}
          >
            S DPH
          </Button>
          <Button
            type="button"
            variant={!withVat ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 px-2.5", !withVat && "shadow-sm")}
            onClick={() => setWithVat(false)}
          >
            Bez DPH
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tickFormatter={formatAxisCZK}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatCZK(Number(value ?? 0))}
                labelFormatter={(label) => `Měsíc: ${label}`}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Příjmy"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Výdaje"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
