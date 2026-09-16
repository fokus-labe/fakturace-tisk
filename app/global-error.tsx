"use client";

import Link from "next/link";
import { useEffect } from "react";

// Fallback pro pád v kořenovém layoutu — nahrazuje celý dokument, proto vlastní
// <html>/<body>. Styly držíme inline, ať je hláška čitelná i bez načtené CSS.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Jen do konzole — obsah chyby uživateli nevypisujeme.
    console.error(error);
  }, [error]);

  return (
    <html lang="cs">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Něco se pokazilo
        </h1>
        <p style={{ maxWidth: "28rem", color: "#6b7280" }}>
          Aplikaci se nepodařilo načíst. Zkus to prosím znovu, nebo se vrať na
          přehled.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              background: "#111827",
              color: "#fff",
            }}
          >
            Zkusit znovu
          </button>
          <Link
            href="/"
            style={{ fontSize: "0.875rem", textDecoration: "underline" }}
          >
            Zpět na přehled
          </Link>
        </div>
      </body>
    </html>
  );
}
