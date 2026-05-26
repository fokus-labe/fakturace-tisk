import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "muted" | "amber" | "blue" | "emerald" | "slate" | "red";

const TONES: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground hover:bg-muted/80",
  amber: "bg-amber-100 text-amber-900 hover:bg-amber-200/80",
  blue: "bg-blue-100 text-blue-900 hover:bg-blue-200/80",
  emerald: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200/80",
  slate: "bg-slate-100 text-slate-700 hover:bg-slate-200/80",
  red: "bg-red-100 text-red-900 hover:bg-red-200/80",
};

interface StatusPillProps {
  href: string;
  label: string;
  count: number;
  tone?: Tone;
}

export function StatusPill({
  href,
  label,
  count,
  tone = "muted",
}: StatusPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        TONES[tone],
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums rounded-full bg-background/60 px-1.5 py-0.5 text-[0.7rem]">
        {count}
      </span>
    </Link>
  );
}
