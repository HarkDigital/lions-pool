// Small CSV helpers shared by the office's export and import buttons.
// RFC 4180: every cell quoted on the way out; quotes, commas, and newlines
// inside quotes handled on the way in.

export type CsvCell = string | number | null | undefined;

export function csvCell(v: CsvCell): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Hand the browser a file to save. A BOM keeps Excel from mangling the dashes. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse CSV text into rows of cells. Tolerates a BOM, CRLF, and quoted cells. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
