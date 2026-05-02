import { Upload, FileSearch, Zap, Shield, ChevronRight, CheckCircle, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { motion, Variants } from "framer-motion";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  userName?: string;
  companyName?: string;
  role?: string;
  industry?: string;
}

const FORMATS = ["PDF", "XLSX", "CSV", "PNG", "JPG", "TIFF"];

const FEATURES = [
  {
    icon: FileSearch,
    title: "Semantic Retrieval",
    desc: "ChromaDB vector store finds relevant chunks by meaning, not just keywords",
  },
  {
    icon: Zap,
    title: "Local LLM",
    desc: "Powered by Ollama + llama3.2 — fully private, zero cloud dependency",
  },
  {
    icon: Shield,
    title: "100% Private",
    desc: "Everything runs on your machine. Invoices never leave your server",
  },
];

const STEPS = [
  { num: "01", label: "Upload Invoice", desc: "PDF, image, or spreadsheet" },
  { num: "02", label: "AI Extracts & Indexes", desc: "Chunked into ChromaDB" },
  { num: "03", label: "Ask Questions", desc: "Get answers with citations" },
];

const stagger: { container: Variants; item: Variants } = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
  }
};

const UploadZone = ({ onFileSelect, userName, companyName, role, industry }: UploadZoneProps) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="flex-1">
      {/* Hero — banner */}
      <div className="bg-white dark:bg-slate-950 text-foreground dark:text-white px-6 py-8 lg:px-10 lg:py-12 relative border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl"
        >
          {/* Top Badges */}
          <motion.div variants={stagger.item} className="mb-8 flex justify-center gap-3">
            {industry && (
              <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/20 shadow-sm flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                Customized for {industry}
              </div>
            )}
            {role && (
              <div className="bg-muted/50 text-muted-foreground px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border shadow-sm">
                {role} Perspective
              </div>
            )}
          </motion.div>

          {/* Headline */}
          <motion.div variants={stagger.item} className="mt-8 mb-8 text-center">
            <h1 className="font-heading text-5xl leading-tight tracking-tighter text-foreground md:text-6xl lg:text-7xl font-black">
              <span className="brand-text">InvoicePro</span>
            </h1>
            <h2 className="mt-4 text-2xl md:text-3xl font-bold text-muted-foreground opacity-80">
              Assisting {companyName || "Your"} Finance Team
            </h2>
            <p className="mt-8 text-muted-foreground text-lg max-w-2xl mx-auto font-medium leading-relaxed">
              Hello {userName?.split(' ')[0] || "Explorer"}, your {companyName || "business"} workspace is ready.
              Ready to process your {industry || "business"} invoices with Llama 3.2.
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div
            variants={stagger.item}
            className="mx-auto mb-12 grid max-w-2xl grid-cols-3 gap-4"
          >
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/30 font-mono text-sm font-bold text-primary">
                  {s.num}
                </div>
                <p className="text-sm font-semibold text-foreground/90">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </motion.div>

          {/* Drop zone */}
          <motion.div variants={stagger.item} className="mx-auto max-w-2xl">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all duration-300 ${dragOver
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
            >
              <label className="block cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.tiff,.bmp"
                  onChange={handleInput}
                />
                <div className="flex flex-col items-center gap-5 px-8 py-12 sm:flex-row sm:justify-between sm:px-10 sm:py-8">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${dragOver ? "border-primary/40 bg-primary/10" : "border-border bg-muted/50"
                      }`}>
                      <Upload className={`h-6 w-6 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">
                        {dragOver ? "Release to upload" : "Drop your invoice here"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        or click to browse your files
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] hover:shadow-primary/35">
                    Browse files
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </label>
            </div>

            {/* Format chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {FORMATS.map((fmt, i) => (
                <motion.span
                  key={fmt}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="rounded-md border border-border bg-muted/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60"
                >
                  {fmt}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Feature cards — light section */}
      <div className="bg-surface-raised px-6 py-14 lg:px-10">
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl"
        >
          <motion.p
            variants={stagger.item}
            className="mb-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            How it works
          </motion.p>
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={stagger.item}
                className="card-glow group rounded-xl border border-border bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-300 hover:border-primary/30"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 transition-colors group-hover:bg-primary/12">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Trust badges */}
          <motion.div
            variants={stagger.item}
            className="mt-10 flex flex-wrap items-center justify-center gap-6 text-center"
          >
            {[
              "No data sent to cloud",
              "Source citations on every answer",
              "Supports PDF, Excel, Images",
            ].map((badge) => (
              <div key={badge} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                {badge}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadZone;
