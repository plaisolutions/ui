import { ToolResultToolConfirmationCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultToolConfirmationCard> = {
  title: "Components/ToolResultToolConfirmationCard",
  component: ToolResultToolConfirmationCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultToolConfirmationCard>

export const ConfirmedActions: Story = {
  args: {
    locale: "es",
    part: {
      type: "tool-call",
      id: "tool_confirm_story",
      name: "confirm_pending_actions",
      toolType: "tool_confirmation",
      input: {},
      state: "completed",
      metadata: {
        type: "tool_confirmation",
        actions: [
          {
            action_id: "a-1",
            tool_name: "gmail_send",
            status: "executed",
            metadata: {
              type: "personal_connector",
              connector: {
                provider: "google",
                capability: "gmail",
                label: "Gmail",
                account_email: "dani@plai.ai",
              },
              action: "send",
              result: {
                id: "m-9",
                link: "https://mail.google.com/mail/#all/m-9",
              },
            },
          },
          {
            action_id: "a-2",
            tool_name: "outlook_calendar_create_event",
            status: "failed",
            error:
              "Provider error 403: The user does not have access to this calendar.",
            metadata: null,
          },
        ],
      },
    },
  },
}
