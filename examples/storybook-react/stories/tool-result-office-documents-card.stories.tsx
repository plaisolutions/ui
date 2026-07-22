import { ToolResultOfficeDocumentsCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultOfficeDocumentsCard> = {
  title: "Components/ToolResultOfficeDocumentsCard",
  component: ToolResultOfficeDocumentsCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultOfficeDocumentsCard>

export const Completed: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_office_completed",
      name: "create_office_documents",
      toolType: "office_documents",
      input: { prompt: "Create the quarterly business review" },
      state: "completed",
      result: { files_created: 3 },
      metadata: {
        type: "office_documents",
        media_files: [
          {
            id: "file_pdf",
            name: "quarterly-review.pdf",
            content_type: "application/pdf",
            url: "https://example.com/quarterly-review.pdf",
          },
          {
            id: "file_docx",
            name: "quarterly-review.docx",
            content_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            url: "https://example.com/quarterly-review.docx",
          },
          {
            id: "file_xlsx",
            name: "quarterly-metrics.xlsx",
            content_type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      },
    },
  },
}

export const Pending: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_office_pending",
      name: "create_office_documents",
      toolType: "office_documents",
      input: { prompt: "Create a project report" },
      state: "pending",
    },
  },
}

export const CompletedWithoutFiles: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_office_empty",
      name: "create_office_documents",
      toolType: "office_documents",
      input: { prompt: "Create a project report" },
      state: "completed",
      result: { files_created: 0 },
      metadata: { type: "office_documents", media_files: [] },
    },
  },
}

export const Error: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_office_error",
      name: "create_office_documents",
      toolType: "office_documents",
      input: { prompt: "Create a project report" },
      state: "error",
      errorDetails: {
        error_type: "DocumentGenerationError",
        error_message: "The document service did not return a file.",
      },
    },
  },
}
