import type { Client, InvoiceRequest, InvoiceTotals } from "@/types/invoice";

const fmtCZK = (n: number) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(d);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
};

export function invoiceRequestSubject(args: {
  client: Client;
  totals: InvoiceTotals;
}) {
  return `[Fokus tisk] Žádost o vystavení faktury – ${args.client.name} – ${fmtCZK(args.totals.withVat)}`;
}

interface TemplateProps {
  invoice: InvoiceRequest;
  client: Client;
  totals: InvoiceTotals;
  accountantName: string;
}

export function InvoiceRequestEmail({
  invoice,
  client,
  totals,
  accountantName,
}: TemplateProps) {
  const bodyStyle: React.CSSProperties = {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#1a1a1a",
    lineHeight: 1.55,
    fontSize: 14,
    maxWidth: 600,
    margin: "0 auto",
    padding: "24px",
  };
  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    background: "#fafafa",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#6b6b6b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  };
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
  };
  const accentBar: React.CSSProperties = {
    background: "#C6E94D",
    height: 6,
    width: 60,
    marginBottom: 16,
  };

  return (
    <div style={bodyStyle}>
      <div style={accentBar} />
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>
        Žádost o vystavení faktury
      </h1>
      <p style={{ color: "#6b6b6b", marginTop: 0 }}>Fokus tisk</p>

      <p>Ahoj {accountantName},</p>
      <p>
        prosím o vystavení faktury podle níže uvedeného podkladu. Detailní
        rozpis položek najdeš v <strong>přiloženém PDF</strong>.
      </p>

      <div style={cardStyle}>
        <div style={labelStyle}>Odběratel</div>
        <div style={{ fontWeight: 600 }}>{client.name}</div>
        {client.ico ? <div>IČO: {client.ico}</div> : null}
        {client.dic ? <div>DIČ: {client.dic}</div> : null}
        {client.address_street ? <div>{client.address_street}</div> : null}
        {client.address_city || client.address_zip ? (
          <div>
            {client.address_zip ?? ""} {client.address_city ?? ""}
          </div>
        ) : null}
        {client.email ? <div>{client.email}</div> : null}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Sumarizace</div>
        <div style={rowStyle}>
          <span>Bez DPH</span>
          <span>{fmtCZK(totals.noVat)}</span>
        </div>
        <div style={rowStyle}>
          <span>DPH (21 %)</span>
          <span>{fmtCZK(totals.vat)}</span>
        </div>
        <div
          style={{
            ...rowStyle,
            borderTop: "1px solid #1a1a1a",
            marginTop: 6,
            paddingTop: 8,
            fontWeight: 700,
          }}
        >
          <span>Celkem k úhradě</span>
          <span>{fmtCZK(totals.withVat)}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Platební údaje</div>
        <div style={rowStyle}>
          <span>Datum vystavení</span>
          <span>{fmtDate(invoice.issued_at)}</span>
        </div>
        <div style={rowStyle}>
          <span>Splatnost</span>
          <span>{fmtDate(invoice.due_date)}</span>
        </div>
        <div style={rowStyle}>
          <span>Variabilní symbol</span>
          <span>{invoice.variable_symbol ?? "—"}</span>
        </div>
        <div style={rowStyle}>
          <span>Způsob platby</span>
          <span>{invoice.payment_method ?? "převodem"}</span>
        </div>
      </div>

      {invoice.notes ? (
        <div style={cardStyle}>
          <div style={labelStyle}>Poznámka</div>
          <div>{invoice.notes}</div>
        </div>
      ) : null}

      <p>
        Až bude faktura vystavená, prosím napiš mi její číslo zpět — doplním ho
        do evidence.
      </p>
      <p>
        Díky!
        <br />
        Jakub Kolstrunk
        <br />
        <span style={{ color: "#6b6b6b" }}>Fokus tisk</span>
      </p>
    </div>
  );
}
