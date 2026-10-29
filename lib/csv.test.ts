import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips quotes, commas, and newlines", () => {
    const rows = [
      ["Account id", "Name", "Email", "Nickname"],
      ["user_1", 'Dave "The Machine" C', "d@x.com", "Two-Point, Tina"],
      ["user_2", "Line\nBreak", "", "Plain"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("accepts a BOM, CRLF, unquoted cells, and skips blank lines", () => {
    const text = "﻿id,nickname\r\nuser_1,Lil Coke\r\n\r\nuser_2,\r\n";
    expect(parseCsv(text)).toEqual([
      ["id", "nickname"],
      ["user_1", "Lil Coke"],
      ["user_2", ""],
    ]);
  });
});
