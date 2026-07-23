import type Anthropic from "@anthropic-ai/sdk";
import type { PageSource } from "@/lib/import/server-validate";

/** Doplněk k promptu, když je faktura složená z víc obrázků (víc stran). */
export const MULTI_PAGE_NOTE = `

POZOR: Tato faktura je JEDEN doklad rozdělený na VÍCE STRAN (obrázky výše jsou v pořadí stran). Zkombinuj údaje ze VŠECH stran do JEDNÉ faktury — typicky hlavička a identifikace na první straně, položky a součty na dalších. NEVYTVÁŘEJ víc faktur, vrať jeden JSON objekt.`;

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Sestaví user content pro Anthropic: nejdřív všechny strany (PDF = document blok,
 * obrázky = image bloky v pořadí stran), AŽ POTOM textový prompt.
 */
export function buildUserContent(
  sources: PageSource[],
  userPrompt: string,
  multiPageImage: boolean,
): Anthropic.Messages.ContentBlockParam[] {
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  for (const s of sources) {
    if (s.kind === "pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: s.base64 },
      });
    } else {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: s.mediaType as ImageMediaType,
          data: s.base64,
        },
      });
    }
  }
  content.push({
    type: "text",
    text: multiPageImage ? userPrompt + MULTI_PAGE_NOTE : userPrompt,
  });
  return content;
}
