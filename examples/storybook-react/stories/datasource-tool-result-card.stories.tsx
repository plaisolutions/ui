import { DatasourceToolResultCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof DatasourceToolResultCard> = {
  title: "Components/DatasourceToolResultCard",
  component: DatasourceToolResultCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof DatasourceToolResultCard>

export const Course: Story = {
  args: {
    type: "COURSE",
    title: "Programa de Diseño Elearning eInnovación",
    description:
      "En este curso aprenderás los principios básicos de la innovación.",
  },
}
