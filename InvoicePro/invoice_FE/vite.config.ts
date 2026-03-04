import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_API_URL || "http://127.0.0.1:8000";

  console.log(`[vite] Proxying /api/* → ${backendUrl}/*`);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("error", (err, _req, _res) => {
              console.error("[proxy error]", err.message);
            });
            proxy.on("proxyReq", (_proxyReq, req) => {
              console.log(`[proxy →] ${req.method} ${req.url}`);
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                console.error(`[proxy ←] ${proxyRes.statusCode} ${req.url}`);
              }
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
