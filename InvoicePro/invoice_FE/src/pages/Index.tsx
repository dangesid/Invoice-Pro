import { useState, useEffect } from "react";
import UploadZone from "@/components/UploadZone";
import DocumentViewer from "@/components/DocumentViewer";
import ChatWidget from "@/components/ChatWidget";
import InvoiceHistory from "@/components/InvoiceHistory";
import { getAuthHeaders, downloadAuthenticatedFile } from "@/lib/auth";
import { apiUrl } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Download, History, X, Search, AlignLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface IngestResult {
  status: string;
  chunks: number;
  invoice_id?: number;
  file?: string;
  summary?: string;
}

export interface InvoiceData {
  sections: {
    section: string;
    fields: { key: string; value: string }[];
  }[];
  line_items?: {
    headers: string[];
    rows: string[][];
  };
  summary?: string;
}

interface UserProfile {
  id: number;
  email: string;
  name: string;
  company: string;
  role?: string;
  industry?: string;
}

export default function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(apiUrl("/api/me"), { headers: getAuthHeaders() });
        if (res.ok) setUser(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchUser();
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setUploading(true);
    setExtracting(true);
    setUploadError(null);
    setExtractError(null);
    setIngestResult(null);
    setInvoiceData(null);
    setShowAnalysis(false);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Single call for both Ingest & Extract
      const res = await fetch(apiUrl("/api/ingest-file"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setIngestResult(data);
      setInvoiceData(data.extracted_data || null);

      setUploading(false);
      setExtracting(false);
      setHistoryRefresh(prev => prev + 1);
      setShowAnalysis(true);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message);
      setUploading(false);
      setExtracting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: History */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 300 : 0, opacity: sidebarOpen ? 1 : 0 }}
          className="border-r bg-card/50 backdrop-blur-xl overflow-hidden hidden md:block relative z-30 h-full"
        >
          <InvoiceHistory
            refreshTrigger={historyRefresh}
            user={user}
            onSelect={(inv) => {
              toast.info(`Loading ${inv.filename}...`);
              setFile(new File([], inv.filename));
              setIngestResult({
                status: "success",
                chunks: 0,
                invoice_id: inv.id,
                file: inv.filename,
                summary: inv.summary
              });
              setInvoiceData({
                sections: [],
                summary: inv.summary
              });
              setShowAnalysis(true);
            }}
          />
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background gradient-bg relative">
          {/* Dashboard Header */}
          <header className="sticky top-0 z-20 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <AlignLeft className="h-4 w-4 text-primary" />
              </Button>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold opacity-70 uppercase tracking-wider text-foreground">
                  {user?.company ? `${user.company} Workspace` : "Workspace"}
                </h2>
                {user?.name && <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-80">Account: {user.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />

              {file && ingestResult?.invoice_id && (
                <div className="flex gap-2">
                  <Button
                    variant={showAnalysis ? "default" : "outline"}
                    size="sm"
                    className="gap-2 rounded-full"
                    onClick={() => setShowAnalysis(!showAnalysis)}
                  >
                    <BarChart3 className="h-4 w-4" /> {showAnalysis ? "Hide Analysis" : "View Analysis"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full"
                    onClick={() => downloadAuthenticatedFile(`/api/invoices/${ingestResult.invoice_id}/download`, `${ingestResult.file}_analysis.pdf`)}
                  >
                    <Download className="h-4 w-4" /> Download Report
                  </Button>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 lg:p-8">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full"
                >
                  <UploadZone
                    onFileSelect={handleFileSelect}
                    userName={user?.name}
                    companyName={user?.company}
                    role={user?.role}
                    industry={user?.industry}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="viewer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col space-y-6"
                >
                  {showAnalysis && ingestResult?.summary && (
                    <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm mb-6">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <div className="flex justify-between items-start mb-4 p-6 pb-0">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                          <Search className="h-5 w-5 text-primary" /> Comprehensive Analysis
                        </h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowAnalysis(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="p-6 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {ingestResult.summary}
                      </p>
                    </Card>
                  )}

                  <DocumentViewer
                    file={file}
                    ingestResult={ingestResult}
                    invoiceData={invoiceData}
                    uploading={uploading}
                    extracting={extracting}
                    uploadError={uploadError}
                    extractError={extractError}
                    onBack={() => setFile(null)}
                    onReExtract={() => handleFileSelect(file!)} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-20 space-y-8">
              <Separator className="opacity-50" />
              <Footer />
            </div>
          </div>
        </main>

        {/* Floating Chat */}
        {file && !uploading && !uploadError && <ChatWidget fileName={file.name} />}
      </div>
    </div>
  );
}
