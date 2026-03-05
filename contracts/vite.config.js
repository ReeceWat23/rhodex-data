import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: ".",
  resolve: {
    alias: {
      // three-globe imports 'three/tsl'; point at file on disk (three exports don't expose build/)
      "three/tsl": path.resolve(__dirname, "node_modules/three/build/three.webgpu.js"),
    },
  },
  optimizeDeps: {
    include: ["three", "three-globe", "react-globe.gl"],
  },
});
