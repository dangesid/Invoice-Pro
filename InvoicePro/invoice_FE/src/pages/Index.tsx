import { useState, useCallback } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import DocumentViewer from "@/components/DocumentViewer";
import ChatWidget from "@/components/ChatWidget";
import { extractInvoiceFromFile } from "@/lib/invoiceExtractor";

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

export default function Index() {
  const [file, setFile]                 = useState<File | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [invoiceData, setInvoiceData]   = useState<InvoiceData | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [extracting, setExtracting]     = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setUploadError(null);
    setExtractError(null);
    setIngestResult(null);
    setInvoiceData(null);

    // ── Step 1: Client-side extraction (instant, no LLM) ─────────────────
    setExtracting(true);
    let invoice: InvoiceData | null = null;
    try {
      invoice = await extractInvoiceFromFile(selectedFile);
      setInvoiceData(invoice);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }

    // ── Step 2: Upload to backend for RAG/chat indexing ───────────────────
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/ingest-file", { method: "POST", body: fd });
      const txt = await res.text();
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(txt); } catch { /**/ }

      if (!res.ok) {
        const msg =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
            ? (body.detail as { msg: string }[]).map((d) => d.msg).join("; ")
            : txt.slice(0, 400);
        throw new Error(msg);
      }
      setIngestResult(body as unknown as IngestResult);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleReExtract = useCallback(async () => {
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    setInvoiceData(null);
    try {
      setInvoiceData(await extractInvoiceFromFile(file));
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Failed");
    } finally {
      setExtracting(false);
    }
  }, [file]);

  const handleBack = useCallback(() => {
    setFile(null);
    setIngestResult(null);
    setInvoiceData(null);
    setUploadError(null);
    setExtractError(null);
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
