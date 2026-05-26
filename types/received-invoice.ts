import type { Supplier } from "./supplier";

export type ReceivedInvoiceCategory =
  | "material"
  | "textil"
  | "reklamni_predmety"
  | "sluzby"
  | "potisk"
  | "obaly"
  | "ostatni";

export type ReceivedInvoiceStatus =
  | "draft"
  | "entered"
  | "paid"
  | "archived"
  | "cancelled";

export type ReceivedPaymentMethod =
  | "faktura"
  | "hotovost"
  | "dodaci_list"
  | "dobirka";

export interface ReceivedInvoice {
  id: string;
  supplier_id: string;
  supplier_invoice_number: string | null;
  issued_at: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: ReceivedPaymentMethod;
  amount_no_vat: number;
  amount_vat: number;
  amount_total: number;
  description: string;
  category: ReceivedInvoiceCategory;
  pdf_url: string | null;
  status: ReceivedInvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceivedInvoiceWithSupplier extends ReceivedInvoice {
  supplier: Supplier;
}

export const RECEIVED_INVOICE_CATEGORY_LABELS: Record<
  ReceivedInvoiceCategory,
  string
> = {
  material: "Materiál",
  textil: "Textil",
  reklamni_predmety: "Reklamní předměty",
  sluzby: "Služby",
  potisk: "Potisk",
  obaly: "Obaly",
  ostatni: "Ostatní",
};

export const RECEIVED_PAYMENT_METHOD_LABELS: Record<
  ReceivedPaymentMethod,
  string
> = {
  faktura: "Faktura",
  hotovost: "Hotovost",
  dodaci_list: "Dodací list",
  dobirka: "Dobírka",
};

export const RECEIVED_INVOICE_STATUS_LABELS: Record<
  ReceivedInvoiceStatus,
  string
> = {
  draft: "Koncept",
  entered: "Zaevidováno",
  paid: "Zaplaceno",
  archived: "Archiv",
  cancelled: "Zrušeno",
};
