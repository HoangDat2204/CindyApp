import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port in dev
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri needs relative paths in production
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
