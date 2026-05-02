import { Github, Twitter, Linkedin, Heart, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-md px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="font-bold text-white text-xs">IP</span>
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">InvoicePro AI</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Intelligent RAG workspace for automated invoice extraction and semantic querying. 
              Built with Ollama, Llama 3.2, and ChromaDB.
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Resources</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
                  Documentation <ExternalLink className="h-2.5 w-2.5" />
                </li>
                <li className="hover:text-primary transition-colors cursor-pointer">Support</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Privacy Policy</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Community</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="hover:text-primary transition-colors cursor-pointer">Github Repository</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Discord</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Twitter</li>
              </ul>
            </div>
          </div>

          {/* Social & Version */}
          <div className="flex flex-col items-start md:items-end space-y-4">
            <div className="flex items-center gap-3">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <motion.a
                  key={i}
                  whileHover={{ scale: 1.1, y: -2 }}
                  href="#"
                  className="rounded-full bg-muted/50 p-2 text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              v1.2.0-stable · Production Ready
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-muted-foreground font-medium">
            © {currentYear} InvoicePro AI · Powered by Llama 3.2 & OnPremise AI
          </p>
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold">
            Designed and build by sid by ❤️
          </p>
        </div>
      </div>
    </footer>
  );
}
