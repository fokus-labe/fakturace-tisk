// Pure konstanty — bezpečné volat ze server i client komponent.
// NIKDY sem nepřidávat "use client" ani React.
//
// Fixní rozsahy Petrovy ETN šablony. Drž sync s lib/etn/generate-xlsx.ts
// (NAKLADY_DATA_START/END, TRZBY_DATA_START/END).
export const ETN_MAX_RECEIVED = 36; // řádky 6–41 (náklady)
export const ETN_MAX_ISSUED = 12; //   řádky 47–58 (tržby)
