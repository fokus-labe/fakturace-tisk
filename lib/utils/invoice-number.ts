import type { SupabaseClient } from "@supabase/supabase-js";

export function generateVariableSymbol(year: number, sequence: number): string {
  return `${year}${String(sequence).padStart(4, "0")}`;
}

export async function nextVariableSymbol(
  supabase: SupabaseClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const prefix = String(year);
  const { data, error } = await supabase
    .from("invoice_requests")
    .select("variable_symbol")
    .like("variable_symbol", `${prefix}%`)
    .order("variable_symbol", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch latest variable symbol: ${error.message}`);
  }

  const latest = data?.[0]?.variable_symbol as string | undefined;
  let nextSeq = 1;
  if (latest && latest.length === 8 && latest.startsWith(prefix)) {
    const seq = parseInt(latest.slice(4), 10);
    if (!Number.isNaN(seq)) nextSeq = seq + 1;
  }
  return generateVariableSymbol(year, nextSeq);
}
