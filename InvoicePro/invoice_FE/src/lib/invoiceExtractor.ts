/**
 * Client-side document extractor — NO LLM, NO API calls.
 *
 * Supports: PDF, CSV, TSV, plain text, Excel (XLSX/XLS), images
 * Strategy: extract raw text → scan every key:value pattern found →
 * group into generic sections → present whatever is found.
 * Nothing is hardcoded to invoice-specific fields.
 */

import type { InvoiceData } from "@/pages/Index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => resolve((e.target?.result as string) ?? "");
    r.onerror = () => resolve("");
    r.readAsText(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

// ─── PDF extractor (pdfjs via CDN) ───────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  try {
    // @ts-ignore – loaded from CDN
    if (!window._pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("pdfjs load failed"));
        document.head.appendChild(s);
      });
      // @ts-ignore
      window._pdfjsLib = window.pdfjsLib;
      // @ts-ignore
      window._pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    // @ts-ignore
    const lib = window._pdfjsLib;
    const buf = await readAsArrayBuffer(file);
    const pdf = await lib.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Preserve rough layout: join items, newline between y-groups
      let lastY: number | null = null;
      let row = "";
      for (const item of content.items as any[]) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 4) {
          parts.push(row.trim());
          row = "";
        }
        row += (row ? "  " : "") + item.str;
        lastY = y;
      }
      if (row.trim()) parts.push(row.trim());
      parts.push(""); // page break
    }
    return parts.join("\n");
  } catch {
    // Fallback: just read as text (works for some text-layer PDFs)
    return readAsText(file);
  }
}

// ─── Excel extractor (SheetJS via CDN) ───────────────────────────────────────

async function extractExcelText(file: File): Promise<string> {
  try {
    // @ts-ignore
    if (!window.XLSX) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.head.appendChild(s);
      });
    }
    // @ts-ignore
    const XLSX = window.XLSX;
    const buf = await readAsArrayBuffer(file);
    const wb = XLSX.read(buf, { type: "array" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv: string = XLSX.utils.sheet_to_csv(ws);
      parts.push(`=== Sheet: ${sheetName} ===`);
      parts.push(csv);
    }
    return parts.join("\n");
  } catch {
    return readAsText(file);
  }
}

// ─── Raw text extractor (CSV, TSV, TXT, etc.) ────────────────────────────────

async function extractPlainText(file: File): Promise<string> {
  return readAsText(file);
}

// ─── Main text extraction dispatcher ─────────────────────────────────────────

async function extractRawText(file: File): Promise<string> {
  const t = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (t === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(file);
  }
  if (
    t.includes("spreadsheet") ||
    t.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return extractExcelText(file);
  }
  if (t.startsWith("image/")) {
    // No OCR client-side without heavy libs — return metadata only
    return "";
  }
  // CSV, TSV, TXT, and anything else readable
  return extractPlainText(file);
}

// ─── Generic key-value scanner ───────────────────────────────────────────────

/** Split text into logical rows */
function toRows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Try to parse a row as "label : value" or "label   value" pairs */
function parseKV(row: string): { key: string; value: string } | null {
  // Explicit colon/dash separator
  const colonMatch = row.match(/^([^:]{2,60}?)\s*[:—–-]\s*(.+)$/);
  if (colonMatch) {
    return { key: colonMatch[1].trim(), value: colonMatch[2].trim() };
  }
  // Two-or-more spaces separator (common in fixed-width documents)
  const spaceMatch = row.match(/^([A-Za-z][A-Za-z\s/()#.]{2,50}?)\s{2,}(.+)$/);
  if (spaceMatch) {
    const k = spaceMatch[1].trim();
    const v = spaceMatch[2].trim();
    // Avoid matching prose sentences
    if (k.split(" ").length <= 6 && v.length < 120) {
      return { key: k, value: v };
    }
  }
  return null;
}

/** Detect if a row looks like a table header */
function isTableHeader(row: string): boolean {
  const cols = row.split(/\s{2,}|\t|,/).map((c) => c.trim()).filter(Boolean);
  if (cols.length < 2) return false;
  // All columns are short words (likely column names)
  return cols.every((c) => c.length < 40 && !/^\d/.test(c));
}

/** Detect if a row looks like a table data row */
function isTableRow(row: string): boolean {
  const cols = row.split(/\s{2,}|\t|,/).map((c) => c.trim()).filter(Boolean);
  return cols.length >= 2;
}

// ─── Build sections from raw text ────────────────────────────────────────────

interface RawSection {
  title: string;
  fields: { key: string; value: string }[];
}

function buildSections(rows: string[]): RawSection[] {
  const sections: RawSection[] = [];
  let current: RawSection = { title: "Document Info", fields: [] };
  sections.push(current);

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];

    // Detect section headers: short, all-caps or title-case, no numbers
    const isHeader =
      row.length > 2 &&
      row.length < 60 &&
      !row.includes(":") &&
      !/\d{3,}/.test(row) &&
      (row === row.toUpperCase() || /^[A-Z][a-z]/.test(row)) &&
      row.split(" ").length <= 6;

    if (isHeader && current.fields.length > 0) {
      current = { title: row, fields: [] };
      sections.push(current);
      i++;
      continue;
    }

    const kv = parseKV(row);
    if (kv && kv.key.length >= 2 && kv.value.length >= 1) {
      current.fields.push(kv);
    }

    i++;
  }

  return sections.filter((s) => s.fields.length > 0);
}

// ─── Table extractor ─────────────────────────────────────────────────────────

function extractTable(
  rows: string[]
): { headers: string[]; rows: string[][] } | null {
  // Find the first row that looks like a header with 3+ columns
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(/\s{2,}|\t|,/).filter(Boolean);
    if (cols.length >= 3 && isTableHeader(rows[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const sep = rows[headerIdx].includes(",") ? "," : /\s{2,}|\t/;
  const headers = rows[headerIdx].split(sep).map((h) => h.trim()).filter(Boolean);
  const dataRows: string[][] = [];

  for (let i = headerIdx + 1; i < rows.length && i < headerIdx + 100; i++) {
    const row = rows[i];
    // Stop at totals/summary lines
    if (/^(total|subtotal|grand|balance|amount due|sum|notes|terms|page)/i.test(row)) break;
    if (!isTableRow(row)) continue;
    const cols = row.split(sep).map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 2) dataRows.push(cols);
  }

  if (dataRows.length === 0) return null;
  return { headers, rows: dataRows };
}

// ─── CSV/TSV specific parser ──────────────────────────────────────────────────

function parseCsvTable(text: string): {
  headers: string[];
  rows: string[][];
} | null {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delim).map((h) => h.replace(/^"|"$/g, "").trim());
  const dataRows = lines.slice(1, 201).map((l) =>
    l.split(delim).map((c) => c.replace(/^"|"$/g, "").trim())
  );
  return { headers, rows: dataRows };
}

// ─── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(
  file: File,
  sections: RawSection[],
  table: { headers: string[]; rows: string[][] } | null
): string {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);

  if (totalFields === 0 && !table) {
    return `${ext} file "${file.name}" — no structured fields detected. Use the chat to ask questions.`;
  }

  const parts: string[] = [`${ext} file: "${file.name}"`];
  if (totalFields > 0) parts.push(`${totalFields} fields extracted across ${sections.length} section(s)`);
  if (table) parts.push(`${table.rows.length} table rows found`);
  return parts.join(" · ");
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function extractInvoiceFromFile(file: File): Promise<InvoiceData> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = file.type.startsWith("image/");
  const isCsv = ext === "csv" || ext === "tsv";

  // ── Image: no client-side OCR, return metadata ───────────────────────────
  if (isImage) {
    return {
      summary: `Image file "${file.name}" — preview shown on the left. Use the chat to query its contents.`,
      sections: [
        {
          section: "File Details",
          fields: [
            { key: "Name", value: file.name },
            { key: "Type", value: file.type || ext.toUpperCase() },
            { key: "Size", value: `${(file.size / 1024).toFixed(1)} KB` },
          ],
        },
      ],
      line_items: null,
    };
  }

  // ── Extract raw text ─────────────────────────────────────────────────────
  let rawText = "";
  try {
    rawText = await extractRawText(file);
  } catch {
    rawText = "";
  }

  if (!rawText || rawText.trim().length < 10) {
    return {
      summary: `"${file.name}" — could not extract readable text from this file.`,
      sections: [
        {
          section: "File Details",
          fields: [
            { key: "Name", value: file.name },
            { key: "Type", value: file.type || ext.toUpperCase() },
            { key: "Size", value: `${(file.size / 1024).toFixed(1)} KB` },
          ],
        },
      ],
      line_items: null,
    };
  }

  // ── CSV/TSV: primarily tabular ───────────────────────────────────────────
  if (isCsv) {
    const table = parseCsvTable(rawText);
    const summary = table
      ? `CSV "${file.name}" — ${table.rows.length} rows × ${table.headers.length} columns`
      : `CSV "${file.name}" — no tabular structure detected`;

    return {
      summary,
      sections: table
        ? [
            {
              section: "Column Overview",
              fields: table.headers.map((h, i) => ({
                key: `Column ${i + 1}`,
                value: h,
              })),
            },
          ]
        : [{ section: "Raw Content", fields: [{ key: "Preview", value: rawText.slice(0, 500) }] }],
      line_items: table,
    };
  }

  // ── All other formats: scan key-value pairs + detect table ───────────────
  const rows = toRows(rawText);
  const sections = buildSections(rows);
  const table = extractTable(rows);

  const invoiceData: InvoiceData = {
    summary: buildSummary(file, sections, table),
    sections: sections.map((s) => ({ section: s.title, fields: s.fields })),
    line_items: table,
  };

  // If absolutely nothing found, show a raw text preview
  if (invoiceData.sections.length === 0) {
    invoiceData.sections = [
      {
        section: "Raw Content Preview",
        fields: [{ key: "Text", value: rawText.slice(0, 800) }],
      },
    ];
  }

  return invoiceData;
}
