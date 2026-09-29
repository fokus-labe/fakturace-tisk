"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: () => void;
  ariaLabel: string;
  className?: string;
}

/** Zaškrtávátko s podporou „indeterminate" stavu (částečný výběr v hlavičce). */
export function IndeterminateCheckbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  ariaLabel,
  className,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      // Klik na zaškrtávátko nesmí probublat do řádku / otevřít detail.
      onClick={(e) => e.stopPropagation()}
      onChange={onCheckedChange}
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded border-input",
        className,
      )}
    />
  );
}
