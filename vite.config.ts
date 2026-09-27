import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { contentPageInputs, contentPagesPlugin } from "./vite/contentPagesPlugin.ts";

const root = path.dirname(fileURLToPath(import.meta.url));

// BASE_PATH is "/saveyobrain/" for GitHub Pages project sites, "/" for a custom domain or local dev.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [contentPagesPlugin()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        main: path.join(root, "index.html"),
        game: path.join(root, "games/save-the-light/index.html"),
        ...contentPageInputs(root),
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
