import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReceivedInvoiceStatus } from "@/types/received-invoice";

const STEPS: { key: ReceivedInvoiceStatus; label: string }[] = [
  { key: "draft", label: "Koncept" },
  { key: "entered", label: "Zaevidováno" },
  { key: "paid", label: "Zaplaceno" },
  { key: "archived", label: "Archiv" },
];

export function ReceivedInvoiceStepper({
  status,
}: {
  status: ReceivedInvoiceStatus;
}) {
  const cancelled = status === "cancelled";
  const currentIdx = cancelled ? -1 : STEPS.findIndex((s) => s.key === status);

  return (
    <div className="relative">
      <ol
        className={cn(
          "flex items-center gap-2 w-full",
          cancelled && "opacity-40",
        )}
      >
        {STEPS.map((step, i) => {
          const isPast = currentIdx > i;
          const isCurrent = currentIdx === i;
          const isFuture = currentIdx < i;
          return (
            <li key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isPast && "bg-emerald-500 text-white",
                    isCurrent && "bg-primary text-primary-foreground",
                    isFuture &&
                      "border border-border bg-background text-muted-foreground",
                  )}
                >
                  {isPast ? <Check className="size-4" /> : <span>{i + 1}</span>}
                </div>
                <span
                  className={cn(
                    "text-sm truncate",
                    isCurrent && "font-medium text-foreground",
                    (isPast || isFuture) && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-3 h-px flex-1",
                    isPast ? "bg-emerald-500" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {cancelled ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1 ring-1 ring-red-300">
            <X className="size-4 text-red-700" />
            <span className="text-sm font-medium text-red-700">Zrušeno</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
