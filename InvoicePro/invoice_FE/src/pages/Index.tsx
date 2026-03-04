import { useState, useCallback } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import DocumentViewer from "@/components/DocumentViewer";
import ChatWidget from "@/components/ChatWidget";

export interface IngestResult {
  status: string;
  file: string;
  chunks: number;
  message: string;
}

export interface InvoiceData {
  summary: string;
  sections: { section: string; fields: { key: string; value: string }[] }[];
  line_items: { headers: string[]; rows: string[][] } | null;
}

// Shorter prompt = fewer tokens = faster response
const EXTRACTION_PROMPT = `Extract all data from this invoice. Reply ONLY with JSON, no markdown:
{"summary":"one sentence: who invoiced whom, for what, total amount","sections":[{"section":"section name","fields":[{"key":"field","value":"value"}]}],"line_items":{"headers":["col1"],"rows":[["val1"]]}}`

const saveJson = (ingest: IngestResult, invoice: InvoiceData | null, fileName: string) => {
  const blob = new Blob([JSON.stringify({ source_file: fileName, extracted_at: new Date().toISOString(), ...ingest, invoice_data: invoice }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${fileName.replace(/\.[^/.]+$/, "")}_extracted.json` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};

const doExtract = async (): Promise<InvoiceData> => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: EXTRACTION_PROMPT }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(typeof e.detail === "string" ? e.detail : `HTTP ${res.status}`);
  }
  const data = await res.json();
  const raw: string = data.answer ?? data.response ?? "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
};

export default function Index() {
  const [file, setFile]               = useState<File | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [extracting, setExtracting]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null); setExtractError(null);
    setIngestResult(null); setInvoiceData(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/ingest-file", { method: "POST", body: fd });
      const txt = await res.text();
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(txt); } catch { /**/ }

      if (!res.ok) {
        const msg = typeof body.detail === "string" ? body.detail
          : Array.isArray(body.detail) ? (body.detail as {msg:string}[]).map(d=>d.msg).join("; ")
          : txt.slice(0, 400);
        throw new Error(msg);
      }

      const ingest = body as unknown as IngestResult;
      setIngestResult(ingest);
      setUploading(false);

      // Start extraction immediately after ingest — no extra delay
      setExtracting(true);
      try {
        const invoice = await doExtract();
        setInvoiceData(invoice);
        saveJson(ingest, invoice, selectedFile.name);
      } catch (e) {
        setExtractError(e instanceof Error ? e.message : "Extraction failed");
      } finally {
        setExtracting(false);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }, []);

  const handleReExtract = useCallback(async () => {
    if (!ingestResult) return;
    setExtracting(true); setExtractError(null); setInvoiceData(null);
    try { setInvoiceData(await doExtract()); }
    catch (e) { setExtractError(e instanceof Error ? e.message : "Failed"); }
    finally { setExtracting(false); }
  }, [ingestResult]);

  const handleBack = useCallback(() => {
    setFile(null); setIngestResult(null); setInvoiceData(null);
    setUploadError(null); setExtractError(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      {!file ? (
        <UploadZone onFileSelect={handleFileSelect} />
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <DocumentViewer
              file={file}
              ingestResult={ingestResult}
              invoiceData={invoiceData}
              uploading={uploading}
              extracting={extracting}
              uploadError={uploadError}
              extractError={extractError}
              onBack={handleBack}
              onReExtract={handleReExtract}
            />
          </div>
          {!uploading && !uploadError && <ChatWidget fileName={file.name} />}
        </>
      )}
    </div>
  );
}
