export function calculateLineTotal(
  quantity: number,
  unitPriceNoVat: number,
  vatRate: number,
) {
  const noVat = quantity * unitPriceNoVat;
  const vat = noVat * (vatRate / 100);
  const withVat = noVat + vat;
  return {
    noVat: Math.round(noVat * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    withVat: Math.round(withVat * 100) / 100,
  };
}

export function calculateInvoiceTotals(
  items: Array<{
    quantity: number;
    unit_price_no_vat: number;
    vat_rate: number;
  }>,
) {
  const totals = items.reduce(
    (acc, item) => {
      const line = calculateLineTotal(
        item.quantity,
        item.unit_price_no_vat,
        item.vat_rate,
      );
      acc.noVat += line.noVat;
      acc.vat += line.vat;
      acc.withVat += line.withVat;
      return acc;
    },
    { noVat: 0, vat: 0, withVat: 0 },
  );
  return {
    noVat: Math.round(totals.noVat * 100) / 100,
    vat: Math.round(totals.vat * 100) / 100,
    withVat: Math.round(totals.withVat * 100) / 100,
  };
}
