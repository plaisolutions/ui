import { ResourceCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ResourceCard> = {
  title: "Components/ResourceCard",
  component: ResourceCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="w-[464px] max-w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ResourceCard>

export const DefaultIcon: Story = {
  args: {
    title: "SCORM",
    description: "15. Conceptos clave de Storyline 360",
    url: "https://example.com/storyline",
  },
}

export const CustomIcon: Story = {
  args: {
    icon: "/favicon.svg",
    title: "VIDEO",
    description: "Introducción al diseño eLearning",
    url: "https://example.com/video",
  },
}
