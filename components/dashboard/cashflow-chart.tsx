"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCZK } from "@/lib/utils/format";

interface CashflowDataPoint {
  month: string; // "2026-05"
  received: number;
  issued: number;
}

interface CashflowChartProps {
  dataWithVat: CashflowDataPoint[];
  dataNoVat: CashflowDataPoint[];
}

const MONTH_LABELS_CZ = [
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

const WIDTH = 800;
const HEIGHT = 300;
const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;

function formatAxisCZK(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
  return val.toString();
}

function monthLabel(key: string): string {
  const m = Number(key.split("-")[1]) - 1;
  return MONTH_LABELS_CZ[m] ?? key;
}

export function CashflowChart({
  dataWithVat,
  dataNoVat,
}: CashflowChartProps) {
  const [showWithVat, setShowWithVat] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = showWithVat ? dataWithVat : dataNoVat;

  const { maxValue, yTicks } = useMemo(() => {
    const allValues = data.flatMap((d) => [d.received, d.issued]);
    const max = Math.max(...allValues, 1000);
    const niceMax = Math.ceil((max * 1.1) / 1000) * 1000;
    return {
      maxValue: niceMax,
      yTicks: [0, 0.25, 0.5, 0.75, 1].map((t) => niceMax * t),
    };
  }, [data]);

  const yScale = (val: number) => CHART_H - (val / maxValue) * CHART_H;
  const xScale = (idx: number) =>
    data.length > 1 ? (idx / (data.length - 1)) * CHART_W : CHART_W / 2;

  const issuedPath = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(d.issued)}`,
    )
    .join(" ");
  const receivedPath = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(d.received)}`,
    )
    .join(" ");

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Cashflow 12 měsíců</h3>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setShowWithVat(true)}
            className={cn(
              "px-3 py-1 rounded-md transition-colors",
              showWithVat
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            S DPH
          </button>
          <button
            type="button"
            onClick={() => setShowWithVat(false)}
            className={cn(
              "px-3 py-1 rounded-md transition-colors",
              !showWithVat
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Bez DPH
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">Příjmy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-muted-foreground">Výdaje</span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Grid + Y labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + CHART_W}
                y1={PAD.top + yScale(tick)}
                y2={PAD.top + yScale(tick)}
                stroke="#E5E5E5"
                strokeDasharray="2,2"
              />
              <text
                x={PAD.left - 8}
                y={PAD.top + yScale(tick) + 4}
                fontSize="11"
                fill="#737373"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                {formatAxisCZK(tick)}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={PAD.left + xScale(i)}
              y={HEIGHT - 15}
              fontSize="11"
              fill="#737373"
              textAnchor="middle"
            >
              {monthLabel(d.month)}
            </text>
          ))}

          {/* Lines and dots */}
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            <path
              d={receivedPath}
              fill="none"
              stroke="#EF4444"
              strokeWidth="2"
            />
            <path
              d={issuedPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
            />

            {data.map((d, i) => (
              <g key={i}>
                <rect
                  x={xScale(i) - 20}
                  y={0}
                  width={40}
                  height={CHART_H}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  style={{ cursor: "crosshair" }}
                />
                <circle
                  cx={xScale(i)}
                  cy={yScale(d.received)}
                  r={hoveredIdx === i ? 5 : 3}
                  fill="#EF4444"
                  pointerEvents="none"
                />
                <circle
                  cx={xScale(i)}
                  cy={yScale(d.issued)}
                  r={hoveredIdx === i ? 5 : 3}
                  fill="#10B981"
                  pointerEvents="none"
                />

                {hoveredIdx === i ? (
                  <line
                    x1={xScale(i)}
                    x2={xScale(i)}
                    y1={0}
                    y2={CHART_H}
                    stroke="#737373"
                    strokeDasharray="2,2"
                    strokeWidth="1"
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            ))}
          </g>
        </svg>

        {hoveredIdx !== null && data[hoveredIdx] ? (
          <div
            className="absolute bg-card border rounded-md shadow-lg p-3 text-xs pointer-events-none"
            style={{
              left: `${((PAD.left + xScale(hoveredIdx)) / WIDTH) * 100}%`,
              top: "10px",
              transform: "translateX(-50%)",
              minWidth: "160px",
            }}
          >
            <div className="font-medium mb-2">
              {(() => {
                const [year, m] = data[hoveredIdx].month.split("-");
                return `${MONTH_LABELS_CZ[Number(m) - 1]} ${year}`;
              })()}
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                Příjmy
              </span>
              <span className="font-mono tabular-nums">
                {formatCZK(data[hoveredIdx].issued)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <div className="w-2 h-2 rounded-sm bg-red-500" />
                Výdaje
              </span>
              <span className="font-mono tabular-nums">
                {formatCZK(data[hoveredIdx].received)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
