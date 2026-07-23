// Serverová validace nahraných souborů pro OCR import.
// Nedůvěřuje MIME z prohlížeče — typ určuje z magic bytes.
// HEIC sem NIKDY nesmí dorazit (konvertuje se v prohlížeči na JPEG), takže ho zde
// vědomě NEpodporujeme; obsah faktury jde do Anthropic vždy jako PDF/JPEG/PNG/WebP.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB / soubor
export const MAX_PAGES_PER_INVOICE = 5;
export const MAX_REQUEST_BYTES = 25 * 1024 * 1024; // strop na celkovou velikost jednoho requestu

export type ServerFileKind = "pdf" | "jpeg" | "png" | "webp";

const IMAGE_MEDIA_TYPE: Record<Exclude<ServerFileKind, "pdf">, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Rozpozná typ z prvních bajtů bufferu. Vrací null pro neznámý/nepodporovaný obsah. */
export function detectServerKind(buf: Buffer): ServerFileKind | null {
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "pdf";
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/** Zdrojová strana faktury pro Anthropic (PDF = document blok, obrázek = image blok). */
export type PageSource =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; mediaType: string; base64: string };

export interface ValidatedPages {
  sources: PageSource[];
  /** true pokud faktura obsahuje víc obrázků (jedna faktura rozdělená na víc stran) */
  multiPageImage: boolean;
}

/**
 * Zvaliduje nahrané soubory jedné faktury a připraví je pro Anthropic.
 * Vyhodí Error s čitelnou hláškou při porušení pravidel.
 */
export async function validateInvoiceFiles(
  files: File[],
): Promise<ValidatedPages> {
  if (files.length === 0) {
    throw new Error("Faktura neobsahuje žádný soubor");
  }
  if (files.length > MAX_PAGES_PER_INVOICE) {
    throw new Error(
      `Jedna faktura může mít max ${MAX_PAGES_PER_INVOICE} stran (nahráno ${files.length})`,
    );
  }

  const sources: PageSource[] = [];
  let totalBytes = 0;
  let imageCount = 0;
  let pdfCount = 0;

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Soubor ${file.name} je větší než 10 MB`);
    }
    totalBytes += file.size;
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new Error("Celková velikost faktury překračuje limit");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectServerKind(buffer);
    if (kind === null) {
      throw new Error(
        `Soubor ${file.name} má nepodporovaný formát (jen PDF, JPG, PNG, WebP)`,
      );
    }

    const base64 = buffer.toString("base64");
    if (kind === "pdf") {
      pdfCount += 1;
      sources.push({ kind: "pdf", base64 });
    } else {
      imageCount += 1;
      sources.push({ kind: "image", mediaType: IMAGE_MEDIA_TYPE[kind], base64 });
    }
  }

  // PDF nelze kombinovat do vícestránkové faktury (skupiny tvoří jen obrázky).
  if (pdfCount > 0 && files.length > 1) {
    throw new Error("PDF nelze spojovat do vícestránkové faktury");
  }

  return { sources, multiPageImage: imageCount > 1 };
}
