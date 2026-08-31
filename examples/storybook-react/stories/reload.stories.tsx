import { Reload } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta = {
  title: "Components/Reload",
  component: Reload,
  tags: ["autodocs"],
  args: {
    onClick: () => undefined,
  },
} satisfies Meta<typeof Reload>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}

export const SpanishLabel: Story = {
  args: { label: "Reintentar" },
}
