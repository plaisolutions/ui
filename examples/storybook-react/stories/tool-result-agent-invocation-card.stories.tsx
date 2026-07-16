import { ToolResultAgentInvocationCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultAgentInvocationCard> = {
  title: "Components/ToolResultAgentInvocationCard",
  component: ToolResultAgentInvocationCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultAgentInvocationCard>

export const Completed: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_agent_story",
      name: "invoke_research_agent",
      toolType: "agent_invocation",
      input: { input: "Summarize the latest customer feedback." },
      state: "completed",
      result: "Customers value faster exports and clearer progress updates.",
      metadata: {
        type: "agent_invocation",
        agent_name: "Research agent",
        agent_id: "agent_123",
        tracked_execution_id: "execution_456",
        thread_id: "thread_789",
      },
    },
  },
}
