import { DatasourceFolderCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof DatasourceFolderCard> = {
  title: "Components/DatasourceFolderCard",
  component: DatasourceFolderCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof DatasourceFolderCard>

export const Course: Story = {
  args: {
    icon: "/favicon.svg",
    type: "COURSE",
    title: "Programa en Diseño Elearning e Innovación",
    description: "Principios de diseño eLearning, Storyline y accesibilidad.",
    url: "https://example.com/course",
    resources: [
      {
        type: "LECCIÓN",
        title: "Conceptos clave de Storyline 360",
        description: "Introducción a escenas, diapositivas y capas.",
        url: "https://example.com/lesson-1",
      },
      {
        type: "VIDEO",
        title: "Estados y accionadores",
        description: "Ejemplos interactivos paso a paso.",
        url: "https://example.com/lesson-2",
      },
    ],
  },
}

export const EmptyFolder: Story = {
  args: {
    type: "FOLDER",
    title: "Recursos pendientes",
    description: "Esta carpeta todavía no contiene recursos públicos.",
    resources: [],
  },
}
