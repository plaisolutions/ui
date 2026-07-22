import { ToolResultCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultCard> = {
  title: "Components/ToolResultCard",
  component: ToolResultCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultCard>

export const UnknownCompleted: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_unknown_completed",
      name: "lookup_subscription",
      toolType: "unknown",
      input: { account_id: "acc_123" },
      state: "completed",
      result: { plan: "Business", status: "active" },
    },
  },
}

export const UnknownPending: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_unknown_pending",
      name: "lookup_subscription",
      toolType: "unknown",
      input: { account_id: "acc_123" },
      state: "pending",
    },
  },
}

export const UnknownError: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_unknown_error",
      name: "lookup_subscription",
      toolType: "unknown",
      input: { account_id: "missing" },
      state: "error",
      errorDetails: {
        error_type: "NotFoundError",
        error_message: "The subscription could not be found.",
      },
    },
  },
}

export const EmailCompleted: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_email_completed",
      name: "send_email",
      toolType: "email_send",
      input: {
        to: ["alex@example.com", "team@example.com"],
        subject: "Weekly update",
        text: "Hello team,\n\nHere is this week's status update.",
      },
      state: "completed",
      result: {
        status: "SENT",
        recipients_count: 2,
        subject: "Weekly update",
        receipt: {
          provider: "resend",
          message_id: "msg_12345",
          raw_status: "queued",
        },
      },
    },
  },
}

export const EmailError: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_email_error",
      name: "send_email",
      toolType: "email_send",
      input: {
        to: ["invalid@example.com"],
        subject: "Weekly update",
      },
      state: "error",
      errorDetails: "The email provider rejected the recipient.",
    },
  },
}
