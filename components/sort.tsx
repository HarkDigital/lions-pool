"use client";

// ---------------------------------------------------------------------------
// Column sorting for every table on the site: the state hook and the header
// cell. Pages keep their own row shapes — they hand over an accessor per
// column and get back a sorted copy from sortRows.
// ---------------------------------------------------------------------------

import { useState, type ReactNode } from "react";
import { compareValues, sortRows, type SortDir, type SortState, type SortValue } from "@/lib/sort";

// The comparison rules live in lib/sort.ts (pure, unit-tested). Re-exported
// here so a page imports its whole sorting toolkit from one place.
export { compareValues, sortRows };
export type { SortDir, SortState, SortValue };

/**
 * Sort state for one table. `toggle(key)` activates a column (ascending, or
 * the column's own first direction), and flips direction on a repeat click.
 */
export function useSort<K extends string>(initial: SortState<K> = { key: null, dir: "asc" }) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K, firstDir: SortDir = "asc") =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir },
    );
  return { sort, toggle, setSort };
}

/**
 * A sortable header cell. Drop it in place of a plain <th>; pass the same
 * className the plain cell had (padding, text-right, etc.). The label is a
 * button that inherits the row's type treatment, with a small arrow that
 * shows the active direction.
 *   firstDir: the direction a fresh click starts in. Use "desc" for columns
 *   where the biggest number is the interesting one (points, totals).
 */
export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  className = "",
  firstDir = "asc",
  title,
}: {
  k: K;
  sort: SortState<K>;
  onSort: (key: K, firstDir?: SortDir) => void;
  children: ReactNode;
  className?: string;
  firstDir?: SortDir;
  /** Accessible name when the visible label is terse (e.g. "W3"). */
  title?: string;
}) {
  const active = sort.key === k;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(k, firstDir)}
        title={title}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded font-[inherit] [letter-spacing:inherit] [text-transform:inherit] transition hover:text-chalk focus-visible:outline-2 focus-visible:outline-sky ${
          active ? "text-chalk" : ""
        }`}
      >
        {children}
        <span
          aria-hidden
          className={`text-[10px] leading-none ${active ? "text-sky" : "opacity-40"}`}
        >
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
