"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopírování selhalo — zkopíruj heslo ručně");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 select-all rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
        {password}
      </code>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={copy}
        aria-label="Kopírovat heslo"
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
    </div>
  );
}
