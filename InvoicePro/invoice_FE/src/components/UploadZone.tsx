import { Upload, FileSearch, Zap, Shield, ChevronRight, CheckCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
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

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  },
};

const UploadZone = ({ onFileSelect }: UploadZoneProps) => {
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
    <div className="flex-1 overflow-auto">
      {/* Hero — navy banner */}
      <div className="hero-navy px-6 py-16 lg:px-10 lg:py-20">
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl"
        >
          {/* Badge */}
          <motion.div variants={stagger.item} className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-white/60">
                RAG-powered invoice intelligence
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div variants={stagger.item} className="mb-5 text-center">
            <h1 className="font-heading text-5xl leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
              Extract & query
              <br />
              <span className="brand-text">any invoice instantly.</span>
            </h1>
          </motion.div>

          <motion.p
            variants={stagger.item}
            className="mx-auto mb-12 max-w-lg text-center text-base leading-relaxed text-white/55"
          >
            Upload an invoice, let our local AI parse and index it, then ask
            questions in plain English — with exact source citations.
          </motion.p>

          {/* Steps */}
          <motion.div
            variants={stagger.item}
            className="mx-auto mb-12 grid max-w-2xl grid-cols-3 gap-4"
          >
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-sm font-bold text-primary">
                  {s.num}
                </div>
                {i < 2 && (
                  <div className="absolute hidden" />
                )}
                <p className="text-sm font-semibold text-white/80">{s.label}</p>
                <p className="text-xs text-white/40">{s.desc}</p>
              </div>
            ))}
          </motion.div>

          {/* Drop zone */}
          <motion.div variants={stagger.item} className="mx-auto max-w-2xl">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all duration-300 ${
                dragOver
                  ? "border-primary/60 bg-primary/5"
                  : "border-white/15 hover:border-primary/40 hover:bg-white/3"
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
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                      dragOver ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/5"
                    }`}>
                      <Upload className={`h-6 w-6 transition-colors ${dragOver ? "text-primary" : "text-white/50"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white/90">
                        {dragOver ? "Release to upload" : "Drop your invoice here"}
                      </p>
                      <p className="mt-0.5 text-xs text-white/40">
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
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/40"
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
                className="card-glow group rounded-xl border border-border bg-white p-6 card-shadow transition-all duration-300"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 transition-colors group-hover:bg-primary/12">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-navy">{f.title}</h3>
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
