import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const root = path.resolve(__dirname, "../..");

export default defineConfig({
  root,
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.join(root, "src") },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", port: 5181, strictPort: true },
});
