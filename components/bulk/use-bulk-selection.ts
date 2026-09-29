"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Správa hromadného výběru řádků v seznamu.
 *
 * `visibleIds` jsou id právě zobrazených řádků (po aplikaci filtrů/řazení).
 * `resetKey` je podpis aktuálního filtru/řazení/provozovny — při jeho změně se
 * výběr vyprázdní, aby nešlo omylem provést akci nad něčím, co uživatel nevidí.
 * Počet i dostupné id se vždy počítají jen z průniku s viditelnými řádky, takže
 * „zbylá" (neviditelná) selekce nikdy neovlivní akci.
 */
export function useBulkSelection(visibleIds: string[], resetKey: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const prevKey = useRef(resetKey);

  useEffect(() => {
    if (prevKey.current !== resetKey) {
      prevKey.current = resetKey;
      setSelectedIds(new Set());
    }
  }, [resetKey]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(visibleIds);
    });
  }, [visibleIds]);

  const selectedVisibleIds = visibleIds.filter((id) => selectedIds.has(id));
  const count = selectedVisibleIds.length;
  const allSelected = visibleIds.length > 0 && count === visibleIds.length;
  const someSelected = count > 0 && !allSelected;

  return {
    selectedVisibleIds,
    count,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  };
}
