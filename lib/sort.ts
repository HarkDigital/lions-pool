// The comparison rules behind every sortable table on the site. Pure logic,
// no React: the header cell and the hook live in components/sort.tsx.
//
// Two rules the whole site relies on. Blanks (no rank yet, no pick filed, no
// date) sink to the bottom whichever way the arrow points, because an empty
// cell is not a small value. And ties keep the order the page passed in, so
// sorting one column never scrambles the sensible default underneath it.

export type SortDir = "asc" | "desc";

export interface SortState<K extends string = string> {
  key: K | null;
  dir: SortDir;
}

/** What a column accessor may return. Numbers sort numerically, strings by
 * locale (digits inside strings compare as numbers, so "W10" follows "W9"),
 * booleans false-before-true ascending. */
export type SortValue = number | string | boolean | null | undefined;

function isBlank(v: SortValue): boolean {
  return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1; // blanks last in either direction
  if (bBlank) return -1;
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") cmp = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean") cmp = Number(a) - Number(b);
  else cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

/** Stable sort by the active column, on a copy. With no active column the
 * rows come back in the order given (the page's own default order). */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  if (!sort.key) return [...rows];
  const get = accessors[sort.key];
  if (!get) return [...rows];
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((x, y) => compareValues(x.v, y.v, sort.dir) || x.i - y.i)
    .map((x) => x.row);
}
