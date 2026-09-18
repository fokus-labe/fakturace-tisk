// Sestavení čitelného názvu staženého PDF podkladu vydané faktury.
// Jediné místo, kde se název souboru tvoří — používá ho endpoint
// app/api/invoice-requests/[id]/pdf/route.ts. Kdyby ho někdy potřeboval i
// klient, importuje se odsud, ať se formát nerozejde.

/**
 * Koncové právní formy, které se z názvu klienta odstraní. Regex se aplikuje až
 * po převodu na ASCII (takže „z.ú." už je „z.u."). Vyžaduje oddělovač (mezera
 * nebo čárka) před formou, aby se neuřízl kus běžného slova. Delší tvary
 * (spol. s r.o.) jsou v alternaci první, aby měly přednost.
 */
const LEGAL_FORM_SUFFIX =
  /[\s,]+(?:spol\.?\s*s\.?\s*r\.?\s*o|s\.?\s*r\.?\s*o|a\.?\s*s|v\.?\s*o\.?\s*s|k\.?\s*s|o\.?\s*p\.?\s*s|z\.?\s*u|z\.?\s*s|s\.?\s*p)\.?\s*$/i;

/**
 * Očistí název klienta pro použití v názvu souboru: odstraní diakritiku
 * převodem na ASCII, uřízne koncovou právní formu, nealfanumerické znaky
 * (mezery, tečky, čárky, …) nahradí pomlčkou a víc pomlček za sebou sloučí do
 * jedné. Vrací prázdný řetězec, pokud po očištění nic nezbyde.
 */
export function slugifyClientName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diakritika → ASCII
    .replace(LEGAL_FORM_SUFFIX, "") // koncová právní forma
    .replace(/[^A-Za-z0-9]+/g, "-") // nepovolené znaky → pomlčka
    .replace(/-+/g, "-") // sloučení pomlček
    .replace(/^-+|-+$/g, ""); // ořez pomlček na krajích
}

/**
 * Naformátuje datum vystavení na RRRR-MM-DD. Zvládne jak čistý datum
 * ("2026-09-18"), tak plný ISO timestamp; u timestampu bere UTC složky, aby
 * datum neposkočilo kvůli časové zóně. Vrací prázdný řetězec pro neplatný vstup.
 */
export function formatIssuedDate(issuedAt: string | null | undefined): string {
  if (!issuedAt) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(issuedAt);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(issuedAt);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sestaví název staženého PDF podkladu ve tvaru
 * `podklad-{odberatel}-{RRRR-MM-DD}.pdf`, např. `podklad-2JCP-2026-09-18.pdf`.
 *
 * Odběratel = očištěný název klienta, datum = sloupec issued_at faktury (ne
 * dnešní datum). Kdyby po očištění zbyl prázdný název klienta, spadne se na
 * dosavadní podobu s uuid faktury (`podklad-{uuid}.pdf`), ať soubor nikdy
 * nezůstane bez jména.
 */
export function buildPodkladFilename(params: {
  clientName: string | null | undefined;
  issuedAt: string | null | undefined;
  fallbackId: string;
}): string {
  const slug = slugifyClientName(params.clientName);
  if (!slug) return `podklad-${params.fallbackId}.pdf`;
  const date = formatIssuedDate(params.issuedAt);
  return date ? `podklad-${slug}-${date}.pdf` : `podklad-${slug}.pdf`;
}
