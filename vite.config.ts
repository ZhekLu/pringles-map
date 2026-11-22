import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative URLs work at /, /repository-name/, and custom GitHub Pages domains.
  base: "./",
  build: { outDir: "dist" },
});
