import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { ISSUER } from "@/config/issuer";
import type {
  Client,
  InvoiceItem,
  InvoiceRequest,
} from "@/types/invoice";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
} from "@/lib/utils/vat";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff",
      fontWeight: 700,
    },
  ],
});

const COLOR_TEXT = "#1a1a1a";
const COLOR_ACCENT = "#C6E94D";
const COLOR_MUTED = "#6b6b6b";
const COLOR_BORDER = "#e5e5e5";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Inter",
    color: COLOR_TEXT,
    lineHeight: 1.4,
  },
  headerBar: {
    backgroundColor: COLOR_ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: COLOR_TEXT,
  },
  headerSubtitle: {
    fontSize: 9,
    marginTop: 2,
    color: COLOR_TEXT,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 24,
  },
  col: { flex: 1 },
  blockLabel: {
    fontSize: 8,
    color: COLOR_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 10 },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLOR_BORDER,
    marginBottom: 20,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 8, color: COLOR_MUTED, marginBottom: 2 },
  metaValue: { fontSize: 11, fontWeight: 600 },
  table: { marginBottom: 16 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: COLOR_TEXT,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: COLOR_BORDER,
  },
  thText: { fontSize: 8, fontWeight: 700, textTransform: "uppercase" },
  cellDesc: { flex: 4 },
  cellQty: { flex: 1, textAlign: "right" },
  cellUnit: { flex: 1.5, textAlign: "right" },
  cellVat: { flex: 1, textAlign: "right" },
  cellNoVat: { flex: 1.5, textAlign: "right" },
  cellTotal: { flex: 1.5, textAlign: "right" },
  totals: {
    marginTop: 6,
    alignSelf: "flex-end",
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10 },
  totalsValue: { fontSize: 10, fontWeight: 600 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 2,
    borderColor: COLOR_TEXT,
  },
  grandLabel: { fontSize: 12, fontWeight: 700 },
  grandValue: { fontSize: 12, fontWeight: 700 },
  notes: {
    marginTop: 24,
    padding: 10,
    backgroundColor: "#fafafa",
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLOR_MUTED,
    textAlign: "center",
    borderTopWidth: 1,
    borderColor: COLOR_BORDER,
    paddingTop: 8,
  },
});

interface InvoicePdfProps {
  invoice: InvoiceRequest;
  client: Client;
  items: InvoiceItem[];
}

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

export function InvoicePdf({ invoice, client, items }: InvoicePdfProps) {
  const totals = calculateInvoiceTotals(items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>PODKLAD PRO VYSTAVENÍ FAKTURY</Text>
          <Text style={styles.headerSubtitle}>
            Tento dokument NENÍ daňový doklad — slouží účetnímu jako podklad.
          </Text>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.blockLabel}>Vystavovatel</Text>
            <Text style={styles.partyName}>{ISSUER.name}</Text>
            <Text style={styles.partyLine}>{ISSUER.division.name}</Text>
            <Text style={styles.partyLine}>{ISSUER.address.street}</Text>
            <Text style={styles.partyLine}>
              {ISSUER.address.zip} {ISSUER.address.city}
            </Text>
            <Text style={styles.partyLine}>{ISSUER.address.country}</Text>
            <Text style={styles.partyLine}>IČO: {ISSUER.ico}</Text>
            {ISSUER.dic ? (
              <Text style={styles.partyLine}>DIČ: {ISSUER.dic}</Text>
            ) : null}
            <Text style={styles.partyLine}>{ISSUER.contact.email}</Text>
            <Text style={styles.partyLine}>{ISSUER.contact.phone}</Text>
          </View>

          <View style={styles.col}>
            <Text style={styles.blockLabel}>Odběratel</Text>
            <Text style={styles.partyName}>{client.name}</Text>
            {client.address_street ? (
              <Text style={styles.partyLine}>{client.address_street}</Text>
            ) : null}
            {client.address_city || client.address_zip ? (
              <Text style={styles.partyLine}>
                {client.address_zip ?? ""} {client.address_city ?? ""}
              </Text>
            ) : null}
            {client.address_country ? (
              <Text style={styles.partyLine}>{client.address_country}</Text>
            ) : null}
            {client.ico ? (
              <Text style={styles.partyLine}>IČO: {client.ico}</Text>
            ) : null}
            {client.dic ? (
              <Text style={styles.partyLine}>DIČ: {client.dic}</Text>
            ) : null}
            {client.email ? (
              <Text style={styles.partyLine}>{client.email}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Datum vystavení</Text>
            <Text style={styles.metaValue}>{fmtDate(invoice.issued_at)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Splatnost</Text>
            <Text style={styles.metaValue}>{fmtDate(invoice.due_date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Variabilní symbol</Text>
            <Text style={styles.metaValue}>
              {invoice.variable_symbol ?? "—"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Způsob platby</Text>
            <Text style={styles.metaValue}>
              {invoice.payment_method ?? "převodem"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.thText, styles.cellDesc]}>Popis</Text>
            <Text style={[styles.thText, styles.cellQty]}>Množ.</Text>
            <Text style={[styles.thText, styles.cellUnit]}>
              J. cena bez DPH
            </Text>
            <Text style={[styles.thText, styles.cellVat]}>DPH %</Text>
            <Text style={[styles.thText, styles.cellNoVat]}>Bez DPH</Text>
            <Text style={[styles.thText, styles.cellTotal]}>Celkem</Text>
          </View>

          {items.map((item) => {
            const line = calculateLineTotal(
              Number(item.quantity),
              Number(item.unit_price_no_vat),
              Number(item.vat_rate),
            );
            return (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.cellDesc}>{item.description}</Text>
                <Text style={styles.cellQty}>{Number(item.quantity)}</Text>
                <Text style={styles.cellUnit}>
                  {fmtCZK(Number(item.unit_price_no_vat))}
                </Text>
                <Text style={styles.cellVat}>{Number(item.vat_rate)} %</Text>
                <Text style={styles.cellNoVat}>{fmtCZK(line.noVat)}</Text>
                <Text style={styles.cellTotal}>{fmtCZK(line.withVat)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Celkem bez DPH</Text>
            <Text style={styles.totalsValue}>{fmtCZK(totals.noVat)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>DPH</Text>
            <Text style={styles.totalsValue}>{fmtCZK(totals.vat)}</Text>
          </View>
          <View style={styles.grand}>
            <Text style={styles.grandLabel}>Celkem k úhradě</Text>
            <Text style={styles.grandValue}>{fmtCZK(totals.withVat)}</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={styles.blockLabel}>Poznámka</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {ISSUER.name} · {ISSUER.division.name} · IČO {ISSUER.ico} ·{" "}
          {ISSUER.contact.email}
        </Text>
      </Page>
    </Document>
  );
}
