import type { ResourceReadModel, UIMessage } from "@plaisolutions/client"
import {
  Clipboard,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageParts,
  ThumbDown,
  ThumbUp,
} from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

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

const assistantMessageWithThinking: UIMessage = {
  id: "message_assistant_thinking_01",
  role: "assistant",
  parts: [
    {
      type: "thinking",
      thinking: "Checking the account status before answering.",
      state: "completed",
    },
    {
      type: "text",
      text: "Your subscription is active through August 1, 2026.",
    },
  ],
}

function MessageWithActionsExample() {
  const [rating, setRating] = useState<"POSITIVE" | "NEGATIVE" | null>(null)
  const text = assistantMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")

  return (
    <Message>
      <MessageAvatar src="" fallback="PLai Assistant" />
      <MessageContent className="rounded-xl bg-white p-4 shadow-sm">
        <MessageHeader>PLai Assistant</MessageHeader>
        <MessageParts message={assistantMessage} />
        <MessageFooter className="mt-3">
          <Clipboard text={text} copyLabel="Copy message" />
          <ThumbUp
            aria-pressed={rating === "POSITIVE"}
            onClick={() => setRating("POSITIVE")}
          />
          <ThumbDown
            aria-pressed={rating === "NEGATIVE"}
            onClick={() => setRating("NEGATIVE")}
          />
        </MessageFooter>
      </MessageContent>
    </Message>
  )
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

const assistantMessageWithEmailToolCall: UIMessage = {
  id: "message_assistant_email_01",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Done. I sent the weekly update email to your team.",
    },
    {
      type: "tool-call",
      id: "tool_email_01",
      name: "send_email",
      toolType: "email_send",
      input: {
        to: ["alex@example.com", "team@example.com"],
        subject: "Weekly update",
        text: "Hello team,\n\nHere is this week's status update.",
      },
      state: "completed",
      result: JSON.stringify({
        status: "SENT",
        recipients_count: 2,
        subject: "Weekly update",
        receipt: {
          provider: "resend",
          message_id: "msg_12345",
          raw_status: "queued",
        },
      }),
    },
  ],
}

function createCourseResource(
  id: string,
  name: string,
  url: string,
): ResourceReadModel {
  return {
    id,
    name,
    type: "SCORM",
    status: "DONE",
    url: null,
    content: null,
    metadata: {},
    extra_info: {
      opengraph: {
        translations: {
          es: {
            title: `OpenGraph: ${name}`,
            description: "Descripción localizada desde OpenGraph.",
            type: "LECCIÓN",
            image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=80",
            url,
          },
        },
      },
    },
    folder: {
      id: "folder-course",
      name: "Programa en Diseño Elearning e Innovación",
      parent_id: null,
      datasource_id: "datasource-course",
      extra_info: {
        type: "COURSE",
        description:
          "En este curso aprenderás los principios básicos de diseño.",
        opengraph: {
          translations: {
            es: {
              title: "Programa localizado con OpenGraph",
              description: "Descripción localizada de la carpeta.",
              type: "CURSO",
              image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=80",
              url: "https://example.com/course",
            },
          },
        },
      },
      created_at: "2026-07-01T10:00:00Z",
      updated_at: "2026-07-01T10:00:00Z",
      parent: null,
    },
    datasource: {
      id: "datasource-course",
      name: "Courses",
      description: "Course resources",
      summary: null,
      type: "UNSTRUCTURED",
      source: "MANUAL",
      metadata_schema: null,
      created_at: "2026-07-01T10:00:00Z",
      updated_at: "2026-07-01T10:00:00Z",
    },
    external_url: url,
    external_resource_id: null,
    store: true,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  }
}

const assistantMessageWithDatasourceResults: UIMessage = {
  id: "message_assistant_datasource_01",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Las capas en Storyline enriquecen la interactividad de un curso eLearning.",
    },
    {
      type: "tool-call",
      id: "tool_datasource_01",
      name: "search_courses",
      toolType: "datasource",
      input: { query: "capas en Storyline" },
      state: "completed",
      result: { count: 2 },
      metadata: {
        documents_metadata: [],
        chunk_ids: null,
        relevance_scores: null,
        resources: [
          createCourseResource(
            "resource-course-1",
            "15. Conceptos clave de Storyline 360",
            "https://example.com/resource-1",
          ),
          createCourseResource(
            "resource-course-2",
            "18. Componentes básicos de Storyline 360",
            "https://example.com/resource-2",
          ),
        ],
      },
    },
  ],
}

const datasourceErrorDetails = {
  error_type: "ProgrammingError",
  error_message: 'column "app_id" of relation "usage_records" does not exist',
  tool_name: "actua_learn_content",
  tool_type: "datasource",
  traceback: "Internal traceback omitted from this fixture.",
}

const assistantMessageWithDatasourceError: UIMessage = {
  id: "message_assistant_datasource_error_01",
  role: "assistant",
  parts: [
    {
      type: "tool-call",
      id: "call_btYGpAwxAcZNz6XzKXyy6kwX",
      name: "actua_learn_content",
      toolType: "datasource",
      input: {
        question: "Qué son las capas de Storyline y para qué sirven",
      },
      state: "error",
      result:
        "I encountered an issue while searching the knowledge base. Please try rephrasing your question or try again later.",
      errorDetails: datasourceErrorDetails,
      metadata: {
        type: "datasource_error",
        error_details: datasourceErrorDetails,
      },
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

type ComposedMessageOptions = {
  message: UIMessage
  align?: "start" | "end"
  avatar?: { src: string; fallback: string }
  header?: string
  footer?: string
  datasourceToolResultsPosition?: "inline" | "before-content"
  locale?: string
}

function composedMessage({
  message,
  align = "start",
  avatar,
  header,
  footer,
  datasourceToolResultsPosition,
  locale,
}: ComposedMessageOptions) {
  return (
    <Message align={align}>
      {avatar ? (
        <MessageAvatar src={avatar.src} fallback={avatar.fallback} />
      ) : null}
      <MessageContent
        className={
          align === "end"
            ? "max-w-[80%] flex-none rounded-xl bg-white p-4 shadow-sm"
            : "rounded-xl bg-white p-4 shadow-sm"
        }
      >
        {header ? <MessageHeader>{header}</MessageHeader> : null}
        <MessageParts
          message={message}
          locale={locale}
          datasourceToolResultsPosition={datasourceToolResultsPosition}
        />
        {footer ? <MessageFooter>{footer}</MessageFooter> : null}
      </MessageContent>
    </Message>
  )
}

export const User: Story = {
  args: { align: "end" },
  render: (args) =>
    composedMessage({
      message: userMessage,
      align: args.align,
      avatar: { src: "", fallback: "John Doe" },
    }),
}

export const Assistant: Story = {
  render: () =>
    composedMessage({
      message: assistantMessage,
      avatar: {
        src: "https://images.unsplash.com/photo-1531299983330-093763e1d963?w=160",
        fallback: "PLai Assistant",
      },
      header: "PLai Assistant",
    }),
}

export const AvatarFallback: Story = {
  render: () =>
    composedMessage({
      message: assistantMessage,
      avatar: {
        src: "https://invalid.example/avatar-does-not-exist.jpg",
        fallback: "John Doe",
      },
      header: "Broken image renders JD",
    }),
}

export const HeaderAndFooter: Story = {
  render: () =>
    composedMessage({
      message: assistantMessage,
      avatar: { src: "", fallback: "PLai Assistant" },
      header: "PLai Assistant",
      footer: "Delivered · just now",
    }),
}

export const WithMessageActions: Story = {
  render: () => <MessageWithActionsExample />,
}

export const AssistantWithToolCall: Story = {
  render: () => composedMessage({ message: assistantMessageWithToolCall }),
}

export const AssistantWithThinking: Story = {
  render: () => composedMessage({ message: assistantMessageWithThinking }),
}

export const AssistantWithEmailToolCall: Story = {
  render: () =>
    composedMessage({ message: assistantMessageWithEmailToolCall }),
}

export const AssistantWithDatasourceResultsFirst: Story = {
  render: () =>
    composedMessage({
      message: assistantMessageWithDatasourceResults,
      locale: "es-ES",
      datasourceToolResultsPosition: "before-content",
    }),
}

export const AssistantWithDatasourceError: Story = {
  render: () =>
    composedMessage({
      message: assistantMessageWithDatasourceError,
      datasourceToolResultsPosition: "before-content",
    }),
}

export const ToolCall: Story = {
  render: () => composedMessage({ message: toolCallMessage }),
}

export const UserWithAttachments: Story = {
  render: () =>
    composedMessage({ message: userMessageWithAttachments, align: "end" }),
}

export const OfficeDocumentsToolCall: Story = {
  render: () => composedMessage({ message: officeDocumentsToolMessage }),
}
