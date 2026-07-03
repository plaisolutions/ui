import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const configDirectory = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(configDirectory, "../../..")

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(viteConfig) {
    const existingAlias = viteConfig.resolve?.alias
    const existingPlugins = viteConfig.plugins ?? []

    viteConfig.resolve ??= {}
    viteConfig.plugins = [...existingPlugins, tailwindcss()]

    if (!Array.isArray(existingAlias)) {
      viteConfig.resolve.alias = {
        ...(existingAlias ?? {}),
        "@plaisolutions/client": resolve(
          workspaceRoot,
          "packages/client/src/index.ts",
        ),
        "@plaisolutions/react/components": resolve(
          workspaceRoot,
          "packages/react/src/components/index.ts",
        ),
        "@plaisolutions/react": resolve(
          workspaceRoot,
          "packages/react/src/index.ts",
        ),
      }
      return viteConfig
    }

    viteConfig.resolve.alias = [
      ...existingAlias,
      {
        find: "@plaisolutions/client",
        replacement: resolve(workspaceRoot, "packages/client/src/index.ts"),
      },
      {
        find: "@plaisolutions/react/components",
        replacement: resolve(
          workspaceRoot,
          "packages/react/src/components/index.ts",
        ),
      },
      {
        find: "@plaisolutions/react",
        replacement: resolve(workspaceRoot, "packages/react/src/index.ts"),
      },
    ]

    return viteConfig
  },
}

export default config
