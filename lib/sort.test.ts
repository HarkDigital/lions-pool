// The sorting primitive behind every table on the site. Blanks sink in both
// directions, ties keep the order the page handed over, and an inactive
// column leaves the rows exactly as they came.

import { describe, expect, it } from "vitest";
import { compareValues, sortRows } from "./sort";

interface Row {
  id: string;
  n?: number | null;
  s?: string | null;
  b?: boolean;
}
const accessors = {
  n: (r: Row) => r.n,
  s: (r: Row) => r.s,
  b: (r: Row) => r.b,
};
const ids = (rows: Row[]) => rows.map((r) => r.id).join(",");

describe("compareValues", () => {
  it("sinks blanks in BOTH directions", () => {
    for (const dir of ["asc", "desc"] as const) {
      expect(compareValues(null, 5, dir)).toBeGreaterThan(0);
      expect(compareValues(5, null, dir)).toBeLessThan(0);
      expect(compareValues(undefined, "a", dir)).toBeGreaterThan(0);
      expect(compareValues("", "a", dir)).toBeGreaterThan(0);
      expect(compareValues(NaN, 1, dir)).toBeGreaterThan(0);
    }
    expect(compareValues(null, undefined, "asc")).toBe(0);
  });

  it("treats 0 and false as real values, not blanks", () => {
    expect(compareValues(0, 5, "asc")).toBeLessThan(0);
    expect(compareValues(false, true, "asc")).toBeLessThan(0);
  });

  it("compares numbers numerically and strings naturally", () => {
    expect(compareValues(9, 10, "asc")).toBeLessThan(0);
    expect(compareValues("W9", "W10", "asc")).toBeLessThan(0);
    expect(compareValues("alice", "Bob", "asc")).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  const rows: Row[] = [
    { id: "a", n: 3, s: "Lions" },
    { id: "b", n: null, s: null },
    { id: "c", n: 1, s: "Saints" },
    { id: "d", n: 3, s: "Lions" },
  ];

  it("leaves the page's own order alone when no column is active", () => {
    expect(ids(sortRows(rows, { key: null, dir: "asc" }, accessors))).toBe("a,b,c,d");
  });

  it("sorts, keeps ties stable, and sinks blanks either way", () => {
    expect(ids(sortRows(rows, { key: "n", dir: "asc" }, accessors))).toBe("c,a,d,b");
    expect(ids(sortRows(rows, { key: "n", dir: "desc" }, accessors))).toBe("a,d,c,b");
  });

  it("groups identical text together, which is what the Answers column needs", () => {
    expect(ids(sortRows(rows, { key: "s", dir: "asc" }, accessors))).toBe("a,d,c,b");
  });

  it("never mutates the array it was given", () => {
    const original = [...rows];
    sortRows(rows, { key: "n", dir: "desc" }, accessors);
    expect(rows).toEqual(original);
  });
});
