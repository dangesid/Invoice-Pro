import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setToken } from "@/lib/auth";
import { apiHeaders, apiTimeoutSignal, apiUrl } from "@/lib/api";
import { Receipt, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const timeout = apiTimeoutSignal();
    try {
      const response = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email, password }),
        signal: timeout.signal,
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.access_token);
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        toast.error(data.detail || "Invalid email or password");
      }
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "Backend request timed out. Check ngrok and backend."
        : "Could not reach backend during login";
      toast.error(message);
    } finally {
      timeout.clear();
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }

    const timeout = apiTimeoutSignal();
    try {
      const res = await fetch(apiUrl("/api/forgot-password"), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email }),
        signal: timeout.signal,
      });
      if (res.ok) {
        toast.success("Password reset link sent to your email!");
      } else {
        const data = await res.json();
        toast.error(data.detail || "Failed to send reset link");
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Backend request timed out. Check ngrok and backend."
        : "Connection error";
      toast.error(message);
    } finally {
      timeout.clear();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background gradient-bg px-4 py-12 relative">
      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl glass overflow-hidden">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="space-y-2 text-center pb-8 pt-10">
            <div className="flex justify-center mb-4">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="rounded-2xl bg-primary shadow-lg shadow-primary/20 p-4"
              >
                <Receipt className="h-8 w-8 text-white" />
              </motion.div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">InvoicePro AI</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Smart invoice analysis powered by RAG
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-primary/50 text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-12 h-12 bg-background/50 border-white/10 focus:border-primary/50 text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold transition-all hover:shadow-lg hover:shadow-primary/30" disabled={loading}>
                {loading ? "Authenticating..." : (
                  <span className="flex items-center gap-2">
                    Sign In <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-10">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-muted-foreground">New here?</span></div>
            </div>
            <div className="text-center text-sm">
              <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4">
                Create an account
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
