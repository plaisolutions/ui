import { Thinking } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof Thinking> = {
  title: "Components/Thinking",
  component: Thinking,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Renders provider-supplied thinking summaries. It never exposes provider signatures or private replay metadata.",
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof Thinking>

export const Starting: Story = {
  args: {
    part: { type: "thinking", thinking: "", state: "streaming" },
  },
}

export const Streaming: Story = {
  args: {
    part: {
      type: "thinking",
      thinking: "Checking the relevant sources and preparing the response.",
      state: "streaming",
    },
  },
}

export const Completed: Story = {
  args: {
    part: {
      type: "thinking",
      thinking: "Checked the relevant sources before producing the answer.",
      state: "completed",
    },
  },
}

export const CustomLabels: Story = {
  args: {
    part: {
      type: "thinking",
      thinking: "He comprobado las fuentes relevantes.",
      state: "completed",
    },
    thinkingLabel: "Pensando…",
    completedLabel: "Resumen del razonamiento",
    defaultOpen: true,
  },
}
