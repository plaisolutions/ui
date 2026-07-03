import type { UIMessage } from "@plaisolutions/client"
import { Message } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof Message> = {
  title: "Components/Message",
  component: Message,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-slate-100 p-6">
        <Story />
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof Message>

const userMessage: UIMessage = {
  id: "message_user_01",
  role: "user",
  parts: [{ type: "text", text: "Hello, I need help with my subscription." }],
}

const assistantMessage: UIMessage = {
  id: "message_assistant_01",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Sure! Could you tell me your account ID?",
    },
  ],
}

const assistantMessageWithToolCall: UIMessage = {
  id: "message_assistant_02",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "I'm going to check your subscription status...",
    },
    {
      type: "tool-call",
      id: "tool_01",
      name: "get_subscription_status",
      input: { accountId: "acc_123" },
      state: "completed",
      result: { status: "active", nextBillingDate: "2026-08-01" },
    },
  ],
}

const toolCallMessage: UIMessage = {
  id: "message_assistant_02",
  role: "assistant",
  parts: [
    {
      type: "tool-call",
      id: "tool_01",
      name: "get_subscription_status",
      input: { accountId: "acc_123" },
      state: "completed",
      result: { status: "active", nextBillingDate: "2026-08-01" },
    },
  ],
}

export const User: Story = {
  args: {
    message: userMessage,
  },
}

export const Assistant: Story = {
  args: {
    message: assistantMessage,
  },
}

export const AssistantWithToolCall: Story = {
  args: {
    message: assistantMessageWithToolCall,
  },
}

export const ToolCall: Story = {
  args: {
    message: toolCallMessage,
  },
}
