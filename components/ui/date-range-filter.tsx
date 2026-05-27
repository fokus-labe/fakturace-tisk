"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { presetToRange, type DatePreset } from "@/lib/date-range/presets";

export type { DatePreset };

const PRESET_LABELS: Record<DatePreset, string> = {
  all: "Vše",
  this_month: "Tento měsíc",
  last_month: "Minulý měsíc",
  this_year: "Tento rok",
  last_year: "Minulý rok",
  custom: "Vlastní rozsah",
};

interface DateRangeFilterProps {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (next: { preset: DatePreset; from: string; to: string }) => void;
}

export function DateRangeFilter({
  preset,
  from,
  to,
  onChange,
}: DateRangeFilterProps) {
  const handlePresetChange = (value: string | null) => {
    const p = (value ?? "all") as DatePreset;
    if (p === "custom") {
      onChange({ preset: p, from, to });
      return;
    }
    const range = presetToRange(p);
    onChange({ preset: p, from: range.from, to: range.to });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Období</Label>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: string | null) =>
                PRESET_LABELS[(value as DatePreset) ?? "all"]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Tento měsíc</SelectItem>
            <SelectItem value="last_month">Minulý měsíc</SelectItem>
            <SelectItem value="this_year">Tento rok</SelectItem>
            <SelectItem value="last_year">Minulý rok</SelectItem>
            <SelectItem value="custom">Vlastní rozsah</SelectItem>
            <SelectItem value="all">Vše</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Od</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) =>
                onChange({ preset, from: e.target.value, to })
              }
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Do</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) =>
                onChange({ preset, from, to: e.target.value })
              }
              className="w-40"
            />
          </div>
        </>
      )}
    </div>
  );
}
