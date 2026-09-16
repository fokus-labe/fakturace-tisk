"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Chybu jen zaloguj — NEvypisuj ji uživateli, hlášky z DB můžou obsahovat data.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Něco se pokazilo</h1>
      <p className="max-w-md text-muted-foreground">
        Při načítání stránky nastala chyba. Zkus to prosím znovu, nebo se vrať
        na přehled.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Zkusit znovu</Button>
        <Link href="/" className="text-sm text-primary underline">
          Zpět na přehled
        </Link>
      </div>
    </div>
  );
}
