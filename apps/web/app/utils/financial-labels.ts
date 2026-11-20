import { tr } from '../composables/useWorkspaceLocale.js';

/** Translate only a missing category's source-owned fallback; persisted category names are never translated. */
export function categoryDisplayLabel(categoryId: string | null, sourceName: string, fallback = 'Nicht kategorisiert') {
  return categoryId === null ? tr(fallback) : sourceName;
}

/** Keep chart labels unique when a translated missing-category label collides with a real category name. */
export function expenseChartGroups<T extends { categoryId: string | null; name: string }>(groups: readonly T[]): T[] {
  const names = new Set(
    groups
      .filter(
        /** Canonical contract-summary and transaction sentinels are not persisted names. */ (row) =>
          row.categoryId !== null && row.categoryId !== 'uncategorized',
      )
      .map(/** Real names retain priority over a generated fallback. */ (row) => row.name),
  );
  return groups.map(
    /** Copy presentation only; exact cents and selection identities remain unchanged. */ (row) => {
      if (row.categoryId !== null && row.categoryId !== 'uncategorized') return { ...row };
      const base = categoryDisplayLabel(row.categoryId, row.name);
      let name = base,
        suffix = 2;
      while (names.has(name)) name = `${base} · ${suffix++}`;
      names.add(name);
      return { ...row, name };
    },
  );
}
