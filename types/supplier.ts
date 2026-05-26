export interface Supplier {
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
  default_payment_method: string | null;
  default_category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
