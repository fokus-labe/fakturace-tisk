import { formatCZK, formatDate } from "@/lib/utils/format";

interface MailtoInput {
  client: {
    name: string;
    ico?: string | null;
  };
  totals: {
    noVat: number;
    vat: number;
    withVat: number;
  };
  dueDate: Date | string;
  variableSymbol: string;
}

export function buildAccountantMailto(input: MailtoInput): {
  href: string;
  subject: string;
  body: string;
} {
  const subject = `[Fokus tisk] Žádost o vystavení faktury – ${input.client.name} – ${formatCZK(input.totals.withVat)}`;

  const body = `Ahoj Petře,

posílám podklad k vystavení faktury z Fokus tisku:

- Odběratel: ${input.client.name}${input.client.ico ? ` (IČO ${input.client.ico})` : ""}
- Celkem bez DPH: ${formatCZK(input.totals.noVat)}
- DPH: ${formatCZK(input.totals.vat)}
- Celkem s DPH: ${formatCZK(input.totals.withVat)}
- Splatnost: ${formatDate(input.dueDate)}
- Variabilní symbol: ${input.variableSymbol}

Detailní podklad mám v PDF, přiložím ho k tomuto e-mailu.

Děkuji,
Jakub Kolstrunk
Fokus tisk`;

  const params = new URLSearchParams({
    subject,
    body,
  });

  const href = `mailto:${process.env.ACCOUNTANT_EMAIL}?${params.toString()}`;

  return { href, subject, body };
}
