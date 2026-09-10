import { ToolError } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolError> = {
  title: "Components/ToolError",
  component: ToolError,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolError>

export const DatasourceErrorSpanish: Story = {
  args: {
    locale: "es-ES",
    part: {
      type: "tool-call",
      id: "tool_datasource_error",
      name: "actua_learn_content",
      toolType: "datasource",
      input: { question: "accesibilidad" },
      state: "error",
      result: "No se pudo completar la búsqueda en la fuente de conocimiento.",
      errorDetails: {
        error_type: "DatasourceError",
        error_message: "La fuente de datos no está disponible.",
      },
    },
  },
}

export const WithoutOutput: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_web_error",
      name: "web_search_actua_web",
      toolType: "perplexity",
      input: { query: "documentation" },
      state: "error",
      errorDetails: "The external service is temporarily unavailable.",
    },
  },
}
