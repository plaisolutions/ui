import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const configDirectory = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@plaisolutions/react/styles.css": resolve(
        configDirectory,
        "../../packages/react/src/styles.css",
      ),
    },
  },
  plugins: [react(), tailwindcss()],
})
