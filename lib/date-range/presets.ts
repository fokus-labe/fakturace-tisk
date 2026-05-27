// Pure helpers — bezpečné volat ze server i z client komponent.
// NIKDY sem nepřidávat "use client" direktivu a žádné React hooks/state.

export type DatePreset =
  | "all"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

function fmt(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function presetToRange(preset: DatePreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "this_year":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
    case "last_year":
      return {
        from: fmt(new Date(y - 1, 0, 1)),
        to: fmt(new Date(y - 1, 11, 31)),
      };
    case "all":
    case "custom":
    default:
      return { from: "", to: "" };
  }
}
