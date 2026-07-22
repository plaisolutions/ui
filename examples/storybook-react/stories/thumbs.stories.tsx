import { ThumbDown, ThumbUp } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta = {
  title: "Components/Rating thumbs",
  component: ThumbUp,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2">
        <Story />
        <ThumbDown onClick={() => undefined} />
      </div>
    ),
  ],
  args: {
    onClick: () => undefined,
  },
} satisfies Meta<typeof ThumbUp>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: {
    "aria-pressed": true,
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const CustomLabel: Story = {
  args: { label: "Respuesta útil" },
}
