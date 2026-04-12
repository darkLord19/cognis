import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
      "/runs": "http://localhost:3000",
      "/configs": "http://localhost:3000",
      "/metrics": "http://localhost:3000",
      "/triple-baseline": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
