import { ISSUER } from "@/config/issuer";
import type { Venue } from "./get-user-venues";

/**
 * Údaje vystavovatele pro PDF podklad — odvozené z provozovny (venue).
 * brand_name = název provozovny (Fokus tisk / Piknik Ústí / …).
 */
export interface IssuerData {
  legal_name: string;
  brand_name: string;
  ico: string;
  dic: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string;
  email: string | null;
  phone: string | null;
  bank_account: string | null;
  iban: string | null;
  data_box: string | null;
}

// Minimální tvar, který helper potřebuje (funguje i pro raw řádek z DB).
type VenueLike = Pick<Venue, "name" | "legal_name" | "ico"> &
  Partial<Omit<Venue, "name" | "legal_name" | "ico">>;

/**
 * Vystavovatel z provozovny. Pokud provozovna nemá vlastní adresu
 * (address_street je prázdné), použije se sídlo Fokus Labe (z config/issuer.ts) —
 * provozovny sdílejí jednu právní osobu i adresu, liší se jen názvem (brand).
 */
export function venueToIssuer(venue: VenueLike): IssuerData {
  const hasOwnAddress = !!venue.address_street;
  return {
    legal_name: venue.legal_name || ISSUER.name,
    brand_name: venue.name,
    ico: venue.ico || ISSUER.ico,
    dic: venue.dic ?? ISSUER.dic,
    address_street: hasOwnAddress ? venue.address_street! : ISSUER.address.street,
    address_city: hasOwnAddress
      ? (venue.address_city ?? null)
      : ISSUER.address.city,
    address_zip: hasOwnAddress
      ? (venue.address_zip ?? null)
      : ISSUER.address.zip,
    address_country: venue.address_country || ISSUER.address.country,
    email: venue.email ?? ISSUER.contact.email,
    phone: venue.phone ?? ISSUER.contact.phone,
    bank_account: venue.bank_account ?? ISSUER.bankAccount.formatted,
    iban: venue.iban ?? ISSUER.bankAccount.iban,
    data_box: venue.data_box ?? ISSUER.dataBox,
  };
}

/**
 * Fallback vystavovatel (Fokus tisk) z config/issuer.ts — pro případy,
 * kdy se venue nepodaří načíst.
 */
export function fokusTiskIssuer(): IssuerData {
  return {
    legal_name: ISSUER.name,
    brand_name: ISSUER.division.name,
    ico: ISSUER.ico,
    dic: ISSUER.dic,
    address_street: ISSUER.address.street,
    address_city: ISSUER.address.city,
    address_zip: ISSUER.address.zip,
    address_country: ISSUER.address.country,
    email: ISSUER.contact.email,
    phone: ISSUER.contact.phone,
    bank_account: ISSUER.bankAccount.formatted,
    iban: ISSUER.bankAccount.iban,
    data_box: ISSUER.dataBox,
  };
}
