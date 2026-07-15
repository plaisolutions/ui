import { ToolResultExternalDatasourceCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultExternalDatasourceCard> = {
  title: "Components/ToolResultExternalDatasourceCard",
  component: ToolResultExternalDatasourceCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof ToolResultExternalDatasourceCard>

export const BigQueryResult: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_external_story",
      name: "warehouse_query",
      toolType: "external_datasource",
      input: { query: "Show active users by country" },
      state: "completed",
      metadata: {
        type: "external_datasource",
        sql_query:
          "SELECT country, COUNT(*) AS active_users\nFROM users\nWHERE active = true\nGROUP BY country\nORDER BY active_users DESC;",
        json_table: {
          country: { "0": "Spain", "1": "Japan", "2": "Canada" },
          active_users: { "0": 120, "1": 98, "2": 64 },
        },
      },
    },
  },
}
