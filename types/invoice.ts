export type InvoiceStatus =
  | "draft"
  | "sent_to_accountant"
  | "invoice_issued"
  | "archived"
  | "cancelled";

export type InvoiceSource = "manual" | "eshop_api";

export type IssuedPaymentMethod = "fakturace" | "hotovost" | "karta" | "QR";

export interface Client {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_request_id: string;
  description: string;
  quantity: number;
  unit_price_no_vat: number;
  vat_rate: number;
  order_index: number;
  created_at: string;
}

export interface InvoiceRequest {
  id: string;
  client_id: string;
  status: InvoiceStatus;
  issued_at: string;
  invoice_issued_at: string | null;
  due_date: string | null;
  variable_symbol: string | null;
  payment_method: string;
  short_description: string | null;
  notes: string | null;
  pdf_url: string | null;
  external_invoice_number: string | null;
  source: InvoiceSource;
  source_reference: string | null;
  source_metadata: Record<string, unknown> | null;
  email_sent_at: string | null;
  accountant_notified_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRequestWithRelations extends InvoiceRequest {
  client: Client;
  items: InvoiceItem[];
}

export interface InvoiceTotals {
  noVat: number;
  vat: number;
  withVat: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
