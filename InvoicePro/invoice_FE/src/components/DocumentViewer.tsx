import {
  ArrowLeft, FileText, Eye, Database, Loader2, AlertCircle,
  CheckCircle2, HardDrive, RefreshCw, ChevronDown, ChevronUp,
  Sheet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import type { IngestResult, InvoiceData } from "@/pages/Index";

interface Props {
  file: File;
  ingestResult: IngestResult | null;
  invoiceData: InvoiceData | null;
  uploading: boolean;
  extracting: boolean;
  uploadError: string | null;
  extractError: string | null;
  onBack: () => void;
  onReExtract: () => void;
}

const COLORS = [
  "border-blue-100 bg-blue-50/70",
  "border-violet-100 bg-violet-50/70",
  "border-amber-100 bg-amber-50/70",
  "border-emerald-100 bg-emerald-50/70",
  "border-rose-100 bg-rose-50/70",
  "border-cyan-100 bg-cyan-50/70",
  "border-orange-100 bg-orange-50/70",
  "border-slate-100 bg-slate-50/70",
];

// ── Progressive reveal ────────────────────────────────────────────────────────
function useProgressiveReveal(data: InvoiceData | null) {
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    if (!data) { setVisibleCount(0); return; }
    setVisibleCount(0);
    const total = data.sections.length + (data.line_items ? 1 : 0);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisibleCount(i);
      if (i >= total) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [data]);
  return visibleCount;
}

// ── Excel / CSV preview ───────────────────────────────────────────────────────
interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

function useSheetPreview(file: File, isSpreadsheet: boolean) {
  const [sheets, setSheets]   = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!isSpreadsheet) return;
    setLoading(true);
    setError("");
    setSheets([]);

    const load = async () => {
      try {
        // Load SheetJS from CDN if not already present
        if (!(window as any).XLSX) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
            s.onload  = () => resolve();
            s.onerror = () => reject(new Error("Failed to load SheetJS"));
            document.head.appendChild(s);
          });
        }
        const XLSX = (window as any).XLSX;

        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: "array" });
        const result: SheetData[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws  = wb.Sheets[sheetName];
          const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          });

          if (raw.length === 0) continue;

          // First non-empty row = headers
          const headers = (raw[0] as string[]).map(String);
          const rows    = raw.slice(1).map(r =>
            (r as string[]).map(String)
          );

          result.push({ name: sheetName, headers, rows });
        }

        setSheets(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not parse spreadsheet");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [file, isSpreadsheet]);

  return { sheets, loading, error };
}

// ── CSV preview ───────────────────────────────────────────────────────────────
function useCsvPreview(file: File, isCsv: boolean) {
  const [sheet, setSheet]     = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isCsv) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text   = (e.target?.result as string) ?? "";
      const lines  = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) { setLoading(false); return; }
      const delim  = lines[0].includes("\t") ? "\t" : ",";
      const parse  = (l: string) => l.split(delim).map(c => c.replace(/^"|"$/g, "").trim());
      const headers = parse(lines[0]);
      const rows    = lines.slice(1, 501).map(parse);
      setSheet({ name: file.name, headers, rows });
      setLoading(false);
    };
    reader.readAsText(file);
  }, [file, isCsv]);

  return { sheet, loading };
}

// ── Spreadsheet table renderer ────────────────────────────────────────────────
function SpreadsheetTable({ headers, rows, maxRows = 200 }: {
  headers: string[];
  rows: string[][];
  maxRows?: number;
}) {
  const visible = rows.slice(0, maxRows);
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-8 border border-border bg-slate-100 px-2 py-1.5 text-center font-mono text-[10px] text-muted-foreground">#</th>
            {headers.map((h, i) => (
              <th key={i}
                className="min-w-[80px] border border-border bg-slate-100 px-3 py-1.5 text-left font-semibold text-navy whitespace-nowrap">
                {h || <span className="text-muted-foreground/40">Col {i + 1}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
              <td className="border border-border/50 px-2 py-1 text-center font-mono text-[10px] text-muted-foreground/50">
                {ri + 1}
              </td>
              {headers.map((_, ci) => (
                <td key={ci}
                  className="max-w-[200px] truncate border border-border/50 px-3 py-1.5 text-navy/80">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="border-t border-border bg-slate-50 px-4 py-2 text-center font-mono text-[10px] text-muted-foreground">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentViewer({
  file, ingestResult, invoiceData,
  uploading, extracting, uploadError, extractError,
  onBack, onReExtract,
}: Props) {
  const fileUrl    = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl]);

  const ext        = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isPdf      = file.type === "application/pdf" || ext === "pdf";
  const isImage    = file.type.startsWith("image/");
  const isXlsx     = file.type.includes("spreadsheet") || file.type.includes("excel") || ext === "xlsx" || ext === "xls";
  const isCsv      = ext === "csv" || ext === "tsv";
  const fileExt    = ext.toUpperCase() || "FILE";
  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

  const [collapsed, setCollapsed]         = useState<Record<string, boolean>>({});
  const [lineItemsOpen, setLineItemsOpen] = useState(true);
  const [activeSheet, setActiveSheet]     = useState(0);
  const visibleCount = useProgressiveReveal(invoiceData);

  const { sheets: xlsSheets, loading: xlsLoading, error: xlsError } = useSheetPreview(file, isXlsx);
  const { sheet: csvSheet, loading: csvLoading }                      = useCsvPreview(file, isCsv);

  const toggle    = (s: string) => setCollapsed(p => ({ ...p, [s]: !p[s] }));
  const isLoading = uploading || extracting;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="flex h-full flex-col">

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3 shadow-sm lg:px-6">
        <Button variant="ghost" size="sm" onClick={onBack}
          className="gap-2 rounded-lg text-xs text-muted-foreground hover:bg-surface-raised hover:text-navy">
          <ArrowLeft className="h-3.5 w-3.5" />New document
        </Button>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-primary/20 bg-primary/8 px-2.5 py-1 font-mono text-[10px] uppercase font-semibold text-primary">{fileExt}</span>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <FileText className="h-3 w-3" />
            <span className="max-w-[200px] truncate font-medium">{file.name}</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{fileSizeMB} MB</span>
          {extracting && <span className="status-pill border border-amber-200 bg-amber-50 text-amber-700 font-semibold"><Loader2 className="h-3 w-3 animate-spin"/>Extracting…</span>}
          {uploading && !extracting && <span className="status-pill border border-primary/20 bg-primary/8 text-primary font-semibold"><Loader2 className="h-3 w-3 animate-spin"/>Indexing…</span>}
          {uploadError && <span className="status-pill border border-destructive/20 bg-destructive/8 text-destructive font-semibold"><AlertCircle className="h-3 w-3"/>Index failed</span>}
          {invoiceData && !extracting && <span className="status-pill border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"><CheckCircle2 className="h-3 w-3"/>Extracted</span>}
        </div>
      </div>

      {/* Split panel */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">

        {/* Left — preview */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="flex flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-5 py-3 text-sm font-semibold text-navy">
            <Eye className="h-4 w-4 text-primary"/>Document Preview
          </div>

          <div className="flex-1 overflow-auto grid-bg p-4 custom-scroll lg:p-6">

            {/* PDF */}
            {isPdf && (
              <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                <iframe src={fileUrl} className="h-[620px] w-full" title="Preview"/>
              </div>
            )}

            {/* Image */}
            {isImage && (
              <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                <img src={fileUrl} alt="Preview" className="w-full object-contain"/>
              </div>
            )}

            {/* Excel / XLSX */}
            {isXlsx && (
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                {xlsLoading && (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                    <p className="text-xs">Loading spreadsheet…</p>
                  </div>
                )}
                {xlsError && (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-6 w-6 text-amber-400"/>
                    <p className="text-xs">{xlsError}</p>
                  </div>
                )}
                {!xlsLoading && !xlsError && xlsSheets.length > 0 && (
                  <>
                    {/* Sheet tabs */}
                    {xlsSheets.length > 1 && (
                      <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-raised px-3 pt-2">
                        {xlsSheets.map((s, i) => (
                          <button key={i} onClick={() => setActiveSheet(i)}
                            className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors ${
                              activeSheet === i
                                ? "border-border bg-white text-navy"
                                : "border-transparent text-muted-foreground hover:text-navy"
                            }`}>
                            <Sheet className="h-3 w-3"/>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Sheet header info */}
                    <div className="flex items-center gap-2 border-b border-border bg-slate-50 px-4 py-2">
                      <Sheet className="h-3.5 w-3.5 text-emerald-600"/>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {xlsSheets[activeSheet]?.headers.length} columns · {xlsSheets[activeSheet]?.rows.length} rows
                      </span>
                    </div>
                    <SpreadsheetTable
                      headers={xlsSheets[activeSheet]?.headers ?? []}
                      rows={xlsSheets[activeSheet]?.rows ?? []}
                    />
                  </>
                )}
              </div>
            )}

            {/* CSV / TSV */}
            {isCsv && (
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                {csvLoading && (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                    <p className="text-xs">Parsing CSV…</p>
                  </div>
                )}
                {!csvLoading && csvSheet && (
                  <>
                    <div className="flex items-center gap-2 border-b border-border bg-slate-50 px-4 py-2">
                      <FileText className="h-3.5 w-3.5 text-primary"/>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {csvSheet.headers.length} columns · {csvSheet.rows.length} rows
                      </span>
                    </div>
                    <SpreadsheetTable headers={csvSheet.headers} rows={csvSheet.rows}/>
                  </>
                )}
              </div>
            )}

            {/* Unsupported */}
            {!isPdf && !isImage && !isXlsx && !isCsv && (
              <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-20"/>
                  <p className="text-sm font-medium">Preview unavailable for {fileExt} files</p>
                  <p className="text-xs opacity-50">Extracted data shown on the right</p>
                </div>
              </div>
            )}

          </div>
        </motion.div>

        {/* Right — extracted data */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-col bg-surface-raised">
          <div className="flex items-center justify-between border-b border-border bg-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Database className="h-4 w-4 text-primary"/>Extracted Data
            </div>
            {invoiceData && !isLoading && (
              <button onClick={onReExtract}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-high hover:text-navy">
                <RefreshCw className="h-3 w-3"/>Re-extract
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-5 custom-scroll lg:p-6">
            <AnimatePresence mode="wait">

              {/* Extracting */}
              {extracting && (
                <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex min-h-[300px] flex-col items-center justify-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500"/>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-navy">Reading document…</p>
                    <p className="mt-1 text-xs text-muted-foreground">Scanning for structured data</p>
                  </div>
                  <div className="w-56">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                      <motion.div className="h-full rounded-full bg-amber-400"
                        initial={{ width: "0%" }} animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "easeInOut" }}/>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Uploading to backend */}
              {uploading && !extracting && !invoiceData && (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex min-h-[300px] flex-col items-center justify-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-navy">Indexing for chat…</p>
                    <p className="mt-1 text-xs text-muted-foreground">Storing in ChromaDB for Q&amp;A</p>
                  </div>
                </motion.div>
              )}

              {/* Extraction error */}
              {extractError && !extracting && (
                <motion.div key="extract-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/>
                    <div>
                      <p className="text-sm font-bold text-amber-700">Could not read document</p>
                      <p className="mt-1 text-xs text-amber-600/80">{extractError}</p>
                    </div>
                  </div>
                  <button onClick={onReExtract}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary">
                    <RefreshCw className="h-3.5 w-3.5"/>Try again
                  </button>
                </motion.div>
              )}

              {/* Upload warning (non-blocking) */}
              {uploadError && invoiceData && !extracting && (
                <motion.div key="upload-warn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/>
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Indexing failed</span> — chat Q&amp;A may be unavailable, but extracted data is shown below.
                  </p>
                </motion.div>
              )}

              {/* Upload error only */}
              {uploadError && !invoiceData && !extracting && !extractError && (
                <motion.div key="upload-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive"/>
                    <div>
                      <p className="text-sm font-bold text-destructive">Upload failed</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Could not index document for chat</p>
                    </div>
                  </div>
                  <pre className="custom-scroll max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-white p-4 font-mono text-xs text-destructive/80">
                    {uploadError}
                  </pre>
                  <button onClick={onBack}
                    className="w-full rounded-xl border border-border bg-white py-2.5 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                    ← Upload a different file
                  </button>
                </motion.div>
              )}

              {/* SUCCESS */}
              {invoiceData && !extracting && !extractError && (
                <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                  {/* Summary */}
                  {invoiceData.summary && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/6 to-primary/3 p-4">
                      <div className="mb-1.5 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary"/>
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">Summary</p>
                      </div>
                      <p className="text-sm leading-relaxed text-navy/80">{invoiceData.summary}</p>
                    </motion.div>
                  )}

                  {/* Sections */}
                  {invoiceData.sections.slice(0, visibleCount).map((section, si) => (
                    <motion.div key={`${section.section}-${si}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                      <button onClick={() => toggle(section.section)}
                        className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors">
                        <p className="text-xs font-bold uppercase tracking-wider text-navy">{section.section}</p>
                        {collapsed[section.section]
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground"/>
                          : <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground"/>}
                      </button>
                      <AnimatePresence>
                        {!collapsed[section.section] && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                            className="overflow-hidden border-t border-border/50">
                            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
                              {section.fields.map((field, fi) => (
                                <motion.div key={`${field.key}-${fi}`}
                                  initial={{ opacity: 0, scale: 0.97 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: fi * 0.03 }}
                                  className={`rounded-lg border p-3 ${COLORS[fi % COLORS.length]}`}>
                                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{field.key}</p>
                                  <p className="mt-0.5 break-words text-sm font-semibold text-navy">{field.value || "—"}</p>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}

                  {/* Table */}
                  {invoiceData.line_items && invoiceData.line_items.rows.length > 0 &&
                    visibleCount > invoiceData.sections.length && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                      <button onClick={() => setLineItemsOpen(v => !v)}
                        className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors">
                        <p className="text-xs font-bold uppercase tracking-wider text-navy">
                          Table Data ({invoiceData.line_items.rows.length} rows)
                        </p>
                        {lineItemsOpen
                          ? <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground"/>
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground"/>}
                      </button>
                      <AnimatePresence>
                        {lineItemsOpen && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                            className="overflow-hidden border-t border-border/50">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-surface-raised">
                                    {invoiceData.line_items.headers.map((h, hi) => (
                                      <th key={hi} className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {invoiceData.line_items.rows.map((row, ri) => (
                                    <tr key={ri} className={`border-t border-border/40 ${ri % 2 === 1 ? "bg-surface-raised/40" : ""}`}>
                                      {row.map((cell, ci) => (
                                        <td key={ci} className="px-4 py-2.5 text-muted-foreground">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* Footer */}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <HardDrive className="h-3.5 w-3.5 text-primary"/>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ingestResult
                        ? <><span className="font-semibold text-navy">{ingestResult.chunks} chunks</span> indexed · Use the <span className="font-semibold text-primary">chat widget</span> for questions.</>
                        : uploading
                        ? "Indexing for chat…"
                        : "Extracted client-side · Use the chat widget to ask questions."}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* Empty */}
              {!uploading && !extracting && !uploadError && !extractError && !invoiceData && (
                <motion.div key="empty" className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Database className="h-10 w-10 opacity-20"/>
                  <p className="text-sm opacity-60">Awaiting file…</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}