import { Clipboard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta = {
  title: "Components/Clipboard",
  component: Clipboard,
  tags: ["autodocs"],
  args: {
    text: "Text copied from PLai",
  },
} satisfies Meta<typeof Clipboard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SpanishLabels: Story = {
  args: {
    copyLabel: "Copiar mensaje",
    copiedLabel: "Mensaje copiado",
  },
}
