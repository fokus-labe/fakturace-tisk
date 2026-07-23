"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Layers,
  Loader2,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTR,
  MAX_FILES,
  groupIsPdf,
  groupLabel,
  pagesWord,
  prepareFile,
  type InvoiceGroup,
  type PreparedFile,
} from "@/lib/import/file-processing";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `f${idCounter}-${idCounter * 2654435761 % 100000}`;
}

/** Náhled obrázku s vlastním object URL (revokuje se při odmountování). */
function Thumb({ file, alt }: { file: File; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-full object-cover" />;
}

function PagePreview({ pf }: { pf: PreparedFile }) {
  if (pf.kind === "pdf") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/40 p-1 text-center">
        <FileText className="size-6 text-muted-foreground" />
        <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
          {pf.originalName}
        </span>
      </div>
    );
  }
  return <Thumb file={pf.file} alt={pf.originalName} />;
}

export interface FileGroupStageProps {
  onProcess: (groups: InvoiceGroup[]) => void;
  processing: boolean;
  /** Popisek dokladu (Faktura). Zatím jednotné pro vydané i přijaté. */
}

export function FileGroupStage({ onProcess, processing }: FileGroupStageProps) {
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preparing, setPreparing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFiles = groups.reduce((s, g) => s + g.files.length, 0);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      if (arr.length === 0) return;
      setPreparing(true);
      const prepared: PreparedFile[] = [];
      for (const f of arr) {
        try {
          prepared.push(await prepareFile(f, nextId()));
        } catch (err) {
          toast.error(
            `${f.name}: ${err instanceof Error ? err.message : "nepodařilo se zpracovat"}`,
          );
        }
      }
      setPreparing(false);
      if (prepared.length === 0) return;
      setGroups((prev) => {
        const room = MAX_FILES - prev.reduce((s, g) => s + g.files.length, 0);
        if (room <= 0) {
          toast.error(`Maximálně ${MAX_FILES} souborů najednou`);
          return prev;
        }
        const toAdd = prepared.slice(0, room);
        if (toAdd.length < prepared.length) {
          toast.error(`Maximálně ${MAX_FILES} souborů najednou`);
        }
        const newGroups: InvoiceGroup[] = toAdd.map((pf) => ({
          id: nextId(),
          files: [pf],
        }));
        return [...prev, ...newGroups];
      });
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedGroups = groups.filter((g) => selected.has(g.id));
  const selectedHasPdf = selectedGroups.some(groupIsPdf);
  const mergedPageCount = selectedGroups.reduce((s, g) => s + g.files.length, 0);
  const canMerge =
    selectedGroups.length >= 2 && !selectedHasPdf && mergedPageCount <= 5;

  const mergeSelected = () => {
    if (selectedGroups.length < 2) return;
    if (selectedHasPdf) {
      toast.error("PDF nelze spojovat do vícestránkové faktury — jen obrázky");
      return;
    }
    if (mergedPageCount > 5) {
      toast.error("Jedna faktura může mít max 5 stran");
      return;
    }
    setGroups((prev) => {
      // zachovej pořadí skupin dle jejich aktuální pozice
      const merged: PreparedFile[] = [];
      for (const g of prev) {
        if (selected.has(g.id)) merged.push(...g.files);
      }
      const firstIdx = prev.findIndex((g) => selected.has(g.id));
      const newGroup: InvoiceGroup = { id: nextId(), files: merged };
      const rest = prev.filter((g) => !selected.has(g.id));
      rest.splice(firstIdx, 0, newGroup);
      return rest;
    });
    setSelected(new Set());
  };

  const splitGroup = (id: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx === -1) return prev;
      const singles: InvoiceGroup[] = prev[idx].files.map((pf) => ({
        id: nextId(),
        files: [pf],
      }));
      const next = [...prev];
      next.splice(idx, 1, ...singles);
      return next;
    });
  };

  const movePage = (groupId: string, from: number, to: number) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (to < 0 || to >= g.files.length) return g;
        const files = [...g.files];
        const [moved] = files.splice(from, 1);
        files.splice(to, 0, moved);
        return { ...g, files };
      }),
    );
  };

  const reset = () => {
    setGroups([]);
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        <Upload className="mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">
          Přetáhni PDF nebo fotky faktur sem, nebo klikni pro výběr
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, JPG, PNG, WebP, HEIC (z iPhonu). Max {MAX_FILES} souborů, 10 MB
          každý.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {preparing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Zpracovávám a zmenšuji soubory…
        </div>
      )}

      {groups.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Panel akcí */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">
                  {groups.length}{" "}
                  {groups.length === 1
                    ? "faktura"
                    : groups.length >= 2 && groups.length <= 4
                      ? "faktury"
                      : "faktur"}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({totalFiles} {totalFiles === 1 ? "soubor" : totalFiles >= 2 && totalFiles <= 4 ? "soubory" : "souborů"})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={mergeSelected}
                  disabled={!canMerge}
                  title={
                    selectedHasPdf
                      ? "PDF nelze spojovat — jen obrázky"
                      : selectedGroups.length < 2
                        ? "Vyber alespoň dvě položky"
                        : mergedPageCount > 5
                          ? "Max 5 stran na fakturu"
                          : undefined
                  }
                >
                  <Layers className="mr-1 size-4" />
                  Spojit do jedné faktury
                  {selectedGroups.length >= 2 ? ` (${selectedGroups.length})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={processing}
                >
                  Vyčistit vše
                </Button>
              </div>
            </div>

            {selectedHasPdf && selectedGroups.length >= 2 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Ve výběru je PDF — spojovat do jedné faktury lze jen obrázky
                (fotky/skeny).
              </p>
            )}

            {/* Mřížka skupin */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {groups.map((g) => {
                const isGroup = g.files.length > 1;
                const isPdf = groupIsPdf(g);
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "flex flex-col rounded-lg border p-2",
                      selected.has(g.id) && "ring-2 ring-primary",
                      isGroup && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <label className="flex min-w-0 cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="size-4 shrink-0"
                          checked={selected.has(g.id)}
                          onChange={() => toggleSelect(g.id)}
                          disabled={isPdf}
                          title={isPdf ? "PDF nelze spojovat" : undefined}
                        />
                        <span className="truncate text-xs font-medium">
                          {groupLabel(g)}
                        </span>
                      </label>
                      <div className="flex shrink-0 items-center">
                        {isGroup && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => splitGroup(g.id)}
                            title="Rozdělit zpět na samostatné soubory"
                            aria-label="Rozdělit"
                          >
                            <Unlink className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => removeGroup(g.id)}
                          aria-label="Odebrat"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isGroup ? (
                      <div className="space-y-1.5">
                        {g.files.map((pf, i) => (
                          <div
                            key={pf.id}
                            className="flex items-center gap-2 rounded border bg-background p-1"
                          >
                            <div className="size-10 shrink-0 overflow-hidden rounded">
                              <PagePreview pf={pf} />
                            </div>
                            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                              {i + 1}. {pf.originalName}
                            </span>
                            <div className="flex shrink-0 flex-col">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => movePage(g.id, i, i - 1)}
                                disabled={i === 0}
                                aria-label="Nahoru"
                              >
                                <ArrowUp className="size-3" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={() => movePage(g.id, i, i + 1)}
                                disabled={i === g.files.length - 1}
                                aria-label="Dolů"
                              >
                                <ArrowDown className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="aspect-[3/4] w-full overflow-hidden rounded border">
                        <PagePreview pf={g.files[0]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => onProcess(groups)}
                disabled={processing || preparing || groups.length === 0}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Zpracovávám…
                  </>
                ) : (
                  <>
                    Spustit OCR ({groups.length}{" "}
                    {groups.length === 1
                      ? "faktura"
                      : groups.length >= 2 && groups.length <= 4
                        ? "faktury"
                        : "faktur"}
                    )
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: zaškrtni víc fotek jedné faktury a klikni „Spojit do jedné
              faktury“. Šipkami srovnáš pořadí stran (max 5 {pagesWord(5)}).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
