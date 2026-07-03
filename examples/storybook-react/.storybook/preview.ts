import type { Preview } from "@storybook/react"
import "../../../packages/react/src/styles.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },
}

export default preview
