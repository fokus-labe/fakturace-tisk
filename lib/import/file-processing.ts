// Sdílené zpracování souborů pro hromadný import faktur (klientská strana).
// - rozpoznání typu podle magic bytes (kvůli HEIC, které prohlížeč často hlásí prázdným MIME)
// - konverze HEIC/HEIF -> JPEG (heic2any, dynamický import ať nezvětšuje initial bundle)
// - zmenšení všech obrázků přes canvas (delší strana max 2000 px, JPEG quality 0.85)
// PDF se nikdy nekonvertuje ani nezmenšuje.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — kontroluje se AŽ po konverzi/zmenšení
export const MAX_FILES = 30;
export const MAX_PAGES_PER_INVOICE = 5;
export const IMAGE_LONG_EDGE = 2000;
export const IMAGE_JPEG_QUALITY = 0.85;

/** MIME typy, které <input accept> nabídne. HEIC/HEIF přijímáme, ale konvertujeme před uploadem. */
export const ACCEPT_ATTR =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export type DetectedKind = "pdf" | "jpeg" | "png" | "webp" | "heic" | null;

/** Rozpozná typ souboru podle magic bytes prvních 16 bajtů. */
export function detectKindFromBytes(bytes: Uint8Array): DetectedKind {
  // PDF: %PDF -> 25 50 44 46
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  // HEIC/HEIF: na offsetu 4 "ftyp" a brand heic/heix/mif1/heif/hevc/msf1
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(
      bytes[8] ?? 0,
      bytes[9] ?? 0,
      bytes[10] ?? 0,
      bytes[11] ?? 0,
    );
    if (["heic", "heix", "mif1", "heif", "hevc", "msf1", "hevx"].includes(brand)) {
      return "heic";
    }
  }
  return null;
}

async function readMagicBytes(file: File): Promise<Uint8Array> {
  const head = file.slice(0, 16);
  return new Uint8Array(await head.arrayBuffer());
}

/** Načte File jako HTMLImageElement přes object URL. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Obrázek se nepodařilo načíst"));
    };
    img.src = url;
  });
}

/** Zmenší obrázek na delší stranu max IMAGE_LONG_EDGE a vrátí JPEG blob. */
async function resizeImageToJpeg(blob: Blob, name: string): Promise<File> {
  const img = await loadImage(blob);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > IMAGE_LONG_EDGE ? IMAGE_LONG_EDGE / longEdge : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není dostupný");
  // bílé pozadí pro případnou průhlednost (PNG/WebP -> JPEG)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const out: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Konverze na JPEG selhala"))),
      "image/jpeg",
      IMAGE_JPEG_QUALITY,
    );
  });

  const baseName = name.replace(/\.[^.]+$/, "");
  return new File([out], `${baseName}.jpg`, { type: "image/jpeg" });
}

export type PreparedKind = "pdf" | "image";

export interface PreparedFile {
  /** stabilní id pro React klíče a grouping */
  id: string;
  /** zpracovaný soubor připravený k uploadu (PDF beze změny, obrázek = JPEG) */
  file: File;
  kind: PreparedKind;
  /** původní název souboru (pro zobrazení a historii) */
  originalName: string;
}

/**
 * Připraví jeden vybraný soubor pro import:
 * - PDF projde beze změny (jen kontrola velikosti a magic bytes)
 * - HEIC/HEIF -> JPEG (heic2any), pak zmenšení
 * - ostatní obrázky -> zmenšení na JPEG
 * Limit 10 MB se kontroluje AŽ po konverzi/zmenšení.
 * Chyby se vrací jako Error (volající je zobrazí u konkrétního souboru a pokračuje).
 */
export async function prepareFile(file: File, idSeed: string): Promise<PreparedFile> {
  const bytes = await readMagicBytes(file);
  const detected = detectKindFromBytes(bytes);

  if (detected === "pdf") {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("PDF je větší než 10 MB");
    }
    return { id: idSeed, file, kind: "pdf", originalName: file.name };
  }

  if (detected === null) {
    throw new Error("Nepodporovaný formát (jen PDF, JPG, PNG, WebP, HEIC)");
  }

  // Obrázek — případně konvertuj HEIC, pak zmenši na JPEG.
  let source: Blob = file;
  if (detected === "heic") {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: IMAGE_JPEG_QUALITY,
      });
      source = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error("Konverze HEIC selhala — vyfoť fakturu znovu jako JPG");
    }
  }

  let processed: File;
  try {
    processed = await resizeImageToJpeg(source, file.name);
  } catch {
    throw new Error("Obrázek se nepodařilo zpracovat");
  }

  if (processed.size > MAX_FILE_SIZE) {
    throw new Error("Obrázek je i po zmenšení větší než 10 MB");
  }

  return { id: idSeed, file: processed, kind: "image", originalName: file.name };
}

/** Jedna faktura ve fázi před OCR = uspořádané strany (soubory). PDF je vždy solo. */
export interface InvoiceGroup {
  id: string;
  files: PreparedFile[];
}

export function groupIsPdf(g: InvoiceGroup): boolean {
  return g.files.some((f) => f.kind === "pdf");
}

export function pagesWord(n: number): string {
  if (n === 1) return "strana";
  if (n >= 2 && n <= 4) return "strany";
  return "stran";
}

export function groupLabel(g: InvoiceGroup): string {
  if (g.files.length > 1) return `Faktura, ${g.files.length} ${pagesWord(g.files.length)}`;
  return g.files[0]?.originalName ?? "Faktura";
}
