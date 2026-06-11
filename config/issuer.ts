// Vystavovatel se od Sezení P3 bere primárně z tabulky `venues` (per provozovna).
// Tento config slouží jen jako FALLBACK pro PDF/ETN, když venue nemá vlastní
// údaje (sdílené sídlo Fokus Labe) nebo se nepodaří načíst. Viz lib/venues/venue-issuer.ts.
export const ISSUER = {
  name: "Fokus Labe, z. ú.",
  ico: "44226586",
  dic: "CZ44226586",
  dataBox: "cafk8va",
  address: {
    street: "Stroupežnického 1372/9",
    city: "Ústí nad Labem-centrum",
    zip: "400 01",
    country: "Česká republika",
  },
  bankAccount: {
    number: "886879359",
    bankCode: "0800",
    formatted: "886879359/0800",
    iban: "CZ7708000000000886879359",
  },
  contact: {
    email: "fokus@fokuslabe.cz",
    phone: "+420 732 710 367",
  },
  division: {
    name: "Fokus tisk",
    note: "Provozovna Fokus Labe, z. ú.",
  },
} as const;