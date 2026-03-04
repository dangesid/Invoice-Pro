import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Bot, AlertCircle,
  FileText, ChevronDown, RotateCcw, Copy, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Source { source: string; page: string; }
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
}
interface ChatWidgetProps { fileName: string; }

const TypingDots = () => (
  <div className="flex items-end gap-2">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-white shadow-sm">
      <Bot className="h-3.5 w-3.5 text-primary" />
    </div>
    <div className="flex gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-3 shadow-sm">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
          style={{ animation: `bounce 1.2s ease-in-out ${d}ms infinite` }} />
      ))}
    </div>
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="ml-1 rounded p-1 opacity-0 transition-all group-hover:opacity-50 hover:!opacity-100 hover:bg-surface-high"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
};

const ChatWidget = ({ fileName }: ChatWidgetProps) => {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (atBottom && scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, atBottom]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 40);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    setAtBottom(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : `HTTP ${res.status}`);
      }
      const data = await res.json();
      const answer: string = data.answer ?? data.response ?? data.message ?? "No response.";
      const sources: Source[] = (data.sources ?? []).map((s: { source: string; page: string | number }) => ({
        source: s.source, page: String(s.page),
      }));
      setMessages((p) => [...p, { id: `a-${Date.now()}`, role: "assistant", content: answer, sources }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: "assistant", content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const answerCount = messages.filter((m) => m.role === "assistant" && !m.error).length;

  return (
    <>
      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 animate-pulse-green"
        aria-label="Toggle chat"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="h-5 w-5" /></motion.span>
            : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageCircle className="h-5 w-5" /></motion.span>
          }
        </AnimatePresence>
        {!open && answerCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-navy font-mono text-[10px] font-bold text-white">
            {answerCount}
          </span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl shadow-navy/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Document Assistant</p>
                  <p className="flex items-center gap-1 font-mono text-[10px] text-primary/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {fileName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])} title="Clear chat"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-high hover:text-navy">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-high hover:text-navy">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 space-y-4 overflow-auto p-4 custom-scroll bg-surface-raised">

              {/* Empty state — plain, no suggestions */}
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center gap-3 pt-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-navy">Ask anything about this document</p>
                  <p className="text-xs text-muted-foreground">Type your question below to get started</p>
                </motion.div>
              )}

              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className={`mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        msg.error ? "border-destructive/20 bg-destructive/8" : "border-border bg-white shadow-sm"}`}>
                        {msg.error ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    )}
                    <div className={`group relative max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-navy text-white"
                        : msg.error
                        ? "rounded-bl-sm border border-destructive/20 bg-destructive/5 text-destructive"
                        : "rounded-bl-sm border border-border bg-white text-navy shadow-sm"
                    }`}>
                      <pre className="whitespace-pre-wrap font-body text-[13px]">{msg.content}</pre>
                      {msg.role === "assistant" && !msg.error && (
                        <div className="absolute -right-1 -top-1"><CopyButton text={msg.content} /></div>
                      )}
                    </div>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                      className="ml-9 flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm">
                          <FileText className="h-2.5 w-2.5" />
                          {src.source} · p{src.page}
                        </span>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <TypingDots />
                </motion.div>
              )}
            </div>

            {/* Scroll to bottom */}
            <AnimatePresence>
              {!atBottom && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-md hover:text-navy">
                  <ChevronDown className="h-3 w-3" />
                  Scroll down
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="border-t border-border bg-white p-3">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this document…"
                  disabled={loading}
                  className="flex-1 rounded-xl border-border bg-surface-raised text-sm text-navy placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-primary/20"
                />
                <Button type="submit" size="sm" disabled={!input.trim() || loading}
                  className="rounded-xl bg-primary px-4 text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/50">
                Ollama · llama3.2 · ChromaDB · all-MiniLM-L6-v2
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
