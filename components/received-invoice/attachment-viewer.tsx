"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Náhled přílohy přijaté faktury.
 * - PDF (`pdf_url` končí `.pdf`): iframe na existující `/pdf` route.
 * - Fotky (`pdf_url` končí `/`): galerie všech stran přes `/attachment?file=…`.
 */
export function AttachmentViewer({
  invoiceId,
  pdfUrl,
}: {
  invoiceId: string;
  pdfUrl: string;
}) {
  const isPdf = pdfUrl.endsWith(".pdf");
  const [pages, setPages] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(!isPdf);

  useEffect(() => {
    if (isPdf) return;
    let cancelled = false;
    fetch(`/api/received-invoices/${invoiceId}/attachment`)
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((json) => {
        if (!cancelled) setPages(json.pages ?? []);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, isPdf]);

  if (isPdf) {
    return (
      <div className="space-y-3">
        <a
          href={`/api/received-invoices/${invoiceId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Otevřít v novém okně
        </a>
        <iframe
          src={`/api/received-invoices/${invoiceId}/pdf`}
          className="h-[600px] w-full rounded-md border"
          title="Náhled přílohy"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Náhled přílohy není k dispozici.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pages.length > 1 ? (
        <p className="text-xs text-muted-foreground">{pages.length} stran</p>
      ) : null}
      <div className="space-y-3">
        {pages.map((name, i) => {
          const src = `/api/received-invoices/${invoiceId}/attachment?file=${encodeURIComponent(name)}`;
          return (
            <a
              key={name}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Strana ${i + 1}`}
                className="w-full rounded-md border"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
