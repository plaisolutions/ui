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

const userMessageWithAttachments: UIMessage = {
  id: "message_user_attachments_01",
  role: "user",
  parts: [
    {
      type: "input_image",
      url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
      title: "diagram.png",
      metadata: { originalFileName: "diagram.png" },
    },
    {
      type: "input_file",
      fileUrl:
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      title: "manual.pdf",
      mimeType: "application/pdf",
      metadata: { originalFileName: "manual.pdf" },
    },
    {
      type: "text",
      text: "Please summarize the attached files.",
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

const officeDocumentsToolMessage: UIMessage = {
  id: "message_assistant_office_01",
  role: "assistant",
  parts: [
    {
      type: "tool-call",
      id: "tool_office_01",
      name: "office_documents",
      toolType: "office_documents",
      input: { query: "Create monthly report" },
      state: "completed",
      result: { status: "ok" },
      metadata: {
        type: "office_documents",
        media_files: [
          {
            id: "mf_1",
            name: "monthly-report.docx",
            url: "https://example.com/monthly-report.docx",
          },
          {
            id: "mf_2",
            name: "monthly-report-summary.pdf",
            url: "https://example.com/monthly-report-summary.pdf",
          },
        ],
      },
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

export const UserWithAttachments: Story = {
  args: {
    message: userMessageWithAttachments,
  },
}

export const OfficeDocumentsToolCall: Story = {
  args: {
    message: officeDocumentsToolMessage,
  },
}
