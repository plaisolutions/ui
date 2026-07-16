import { ToolResultWorkflowDispatchCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultWorkflowDispatchCard> = {
  title: "Components/ToolResultWorkflowDispatchCard",
  component: ToolResultWorkflowDispatchCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultWorkflowDispatchCard>

export const Dispatched: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_workflow_story",
      name: "dispatch_monthly_report",
      toolType: "workflow_dispatch",
      input: { month: "2026-07" },
      state: "completed",
      result: JSON.stringify({
        execution_id: "execution_123",
        workflow_id: "workflow_456",
        workflow_name_slug: "monthly-report",
        status: "DISPATCHED",
      }),
      metadata: { type: "workflow_dispatch" },
    },
  },
}
