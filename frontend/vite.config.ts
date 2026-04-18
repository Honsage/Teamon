import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend =
    env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true
        },
        "/ws": {
          target: backend,
          changeOrigin: true,
          ws: true
        },
        "/media": {
          target: backend,
          changeOrigin: true
        }
      }
    }
  };
});
