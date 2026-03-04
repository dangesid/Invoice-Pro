import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-heading text-8xl gold-text">404</p>
        <p className="mt-3 text-muted-foreground">Page not found.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 rounded-xl border border-border/60 px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground hover:bg-surface-raised"
        >
          Back to home
        </button>
      </motion.div>
    </div>
  );
};

export default NotFound;
