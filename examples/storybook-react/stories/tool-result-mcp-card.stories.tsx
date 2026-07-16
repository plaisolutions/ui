import { ToolResultMcpCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultMcpCard> = {
  title: "Components/ToolResultMcpCard",
  component: ToolResultMcpCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultMcpCard>

export const Completed: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_mcp_story",
      name: "mcp_github_search_issues",
      toolType: "mcp_tool",
      input: { repository: "plaisolutions/ui", query: "tool results" },
      state: "completed",
      result: "Found 3 matching issues.",
      metadata: {
        type: "mcp_tool",
        mcp_server_url: "https://mcp.example.com/github",
        mcp_tool_name: "search_issues",
      },
    },
  },
}
