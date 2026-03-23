import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/** In Docker Compose dev, set VITE_DEV_PROXY_TARGET=http://cowork_backend:8000 */
const devApiTarget =
  process.env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:8000"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
})
