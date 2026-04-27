import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/upload": "http://localhost:8000",
      "/load-sample": "http://localhost:8000",
      "/query": "http://localhost:8000",
      "/chat": "http://localhost:8000",
      "/session": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
