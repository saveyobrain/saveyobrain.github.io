import { defineConfig } from "vitest/config";

// BASE_PATH is "/saveyobrain/" for GitHub Pages project sites, "/" for a custom domain or local dev.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
