import { useEffect, useState } from "react";
import { clearToken, getAuthHeaders, downloadAuthenticatedFile } from "@/lib/auth";
import { apiUrl } from "@/lib/api";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { 
  User, Mail, ShieldCheck, Clock, Trash2, 
  ChevronRight, FileText, Download, Settings, 
  LogOut, Search, X 
} from "lucide-react";

interface UserProfile {
  id: number;
  email: string;
  name: string;
  company: string;
}

interface Invoice {
  id: number;
  filename: string;
  upload_date: string;
  summary: string;
}

interface InvoiceHistoryProps {
  onSelect: (invoice: Invoice) => void;
  refreshTrigger: number;
  user?: UserProfile | null;
  onClose?: () => void;
}

const InvoiceHistory = ({ refreshTrigger, onSelect, user, onClose }: InvoiceHistoryProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch(apiUrl("/api/invoices"), { headers: getAuthHeaders() });
        if (res.ok) {
          setInvoices(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [refreshTrigger]);

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all invoice history?")) return;
    try {
      const res = await fetch(apiUrl("/api/invoices"), { 
        method: "DELETE", 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        setInvoices([]);
      }
    } catch (e) {
      console.error("Failed to clear history", e);
    }
  };

  if (loading) return <div className="p-4 space-y-3">
    {[1,2,3].map(i => <div key={i} className="h-16 w-full animate-pulse bg-muted rounded-lg" />)}
  </div>;

  return (
    <div className="flex flex-col h-full bg-card/30">
      {/* User Tile */}
      <div className="p-4 border-b bg-muted/20 relative">
        {onClose && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-background/80 transition-all text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-foreground truncate">
              {user?.name || (user?.email ? user.email.split('@')[0] : "Authorized User")}
            </h4>
            <p className="text-[9px] text-primary truncate uppercase tracking-[0.2em] font-black">
              {user?.company || "Personal Workspace"}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors">
            <Mail className="h-3 w-3" />
            <span className="truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-500 px-2 py-1 bg-emerald-500/5 rounded border border-emerald-500/10">
            <ShieldCheck className="h-3 w-3" />
            <span>Verified Account</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b flex items-center justify-between bg-muted/10">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-primary" /> Recent Invoices
        </h3>
        {invoices.length > 0 && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClearAll}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Clear all history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2 border-b bg-muted/5">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search invoices..." 
            className="w-full bg-background/50 border border-border rounded-lg py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {invoices.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-xs">
              No invoices found
            </div>
          ) : (
            invoices.map((inv) => (
              <motion.div
                key={inv.id}
                whileHover={{ x: 4 }}
                className="group relative flex flex-col p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-all"
                onClick={() => onSelect(inv)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-none mb-1">{inv.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(inv.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2 italic bg-muted/30 p-1.5 rounded-md border border-white/5">
                  {inv.summary || "No summary available"}
                </div>
                
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] gap-1 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAuthenticatedFile(`/api/invoices/${inv.id}/download`, `${inv.filename}_analysis.pdf`);
                    }}
                  >
                    <Download className="h-3 w-3" /> Download Report
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/10 space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-xs font-semibold rounded-lg hover:bg-muted/50">
          <Settings className="h-4 w-4" /> Settings
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 h-10 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );
};

export default InvoiceHistory;
