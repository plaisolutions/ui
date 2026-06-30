import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@plai/client": resolve(__dirname, "../client/src/index.ts"),
    },
  },
})
