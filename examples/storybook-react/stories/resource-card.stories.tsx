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

export const OpenGraphContent: Story = {
  args: {
    icon: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=80",
    type: "ARTICLE",
    title: "Design systems for learning products",
    description:
      "How reusable patterns improve consistency across educational interfaces.",
    url: "https://example.com/design-systems",
  },
}

export const WithoutUrl: Story = {
  args: {
    type: "DOCUMENT",
    title: "Internal product brief",
    description: "This resource is visible but does not have a public link.",
    url: null,
  },
}
