import { motion } from "framer-motion";
import { Activity, Cpu, WifiOff, FileCheck } from "lucide-react";
import { useState, useEffect } from "react";

const Header = () => {
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [activeInvoice, setActiveInvoice] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setHealth("online");
          setErrorDetail(null);
          setActiveInvoice(
            data.active_invoice && data.active_invoice !== "none" ? data.active_invoice : null
          );
        } else {
          setHealth("offline");
          setErrorDetail(`/health returned ${res.status}`);
        }
      } catch (e) {
        setHealth("offline");
        setErrorDetail(e instanceof Error ? e.message : "Connection refused");
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full"
    >
      <div className="glass border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-6 py-3.5 lg:px-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/20">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-none text-navy">
                Invoice<span className="brand-text">Pro AI</span>
              </h1>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                RAG · Ollama · ChromaDB
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {activeInvoice && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 sm:flex"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground">
                  {activeInvoice}
                </span>
              </motion.div>
            )}

            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              health === "online"
                ? "border-primary/20 bg-primary/5"
                : health === "offline"
                ? "border-destructive/20 bg-destructive/5"
                : "border-border bg-surface-raised"
            }`}>
              {health === "checking" && <Activity className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />}
              {health === "online"   && <Cpu      className="h-3.5 w-3.5 text-primary" />}
              {health === "offline"  && <WifiOff  className="h-3.5 w-3.5 text-destructive" />}
              <span className={`text-[11px] font-semibold ${
                health === "online"  ? "text-primary" :
                health === "offline" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {health === "checking" ? "Connecting…" :
                 health === "online"   ? "Backend Online" : "Backend Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Offline warning */}
        {health === "offline" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="border-t border-destructive/15 bg-destructive/5 px-6 py-2"
          >
            <p className="font-mono text-[11px] text-destructive/80">
              ⚠ Cannot reach backend at <code className="font-bold">http://127.0.0.1:8000</code>
              {errorDetail && ` — ${errorDetail}`}
              {" · "}Run:{" "}
              <code className="font-bold">uvicorn backend.invoice_api:app --host 0.0.0.0 --port 8000</code>
            </p>
          </motion.div>
        )}
      </div>
      <div className="brand-line h-[2px] w-full" />
    </motion.header>
  );
};

export default Header;
