import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultCard", () => {
  it("renders tool result with input and output", () => {
    render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_1",
          name: "search_docs",
          toolType: "datasource",
          input: { q: "billing" },
          state: "completed",
          result: { total: 3 },
        }}
      />,
    )

    expect(screen.getByText("search_docs")).toBeTruthy()
    expect(screen.getByText("completed")).toBeTruthy()
    expect(screen.getByText(/"q": "billing"/)).toBeTruthy()
    expect(screen.getByText(/"total": 3/)).toBeTruthy()
  })

  it("renders error details when provided", () => {
    render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_2",
          name: "http_request",
          input: { url: "https://example.com" },
          state: "error",
          errorDetails: "Request timeout",
        }}
      />,
    )

    expect(screen.getByText("error")).toBeTruthy()
    expect(screen.getByText(/Request timeout/)).toBeTruthy()
  })

  it("renders structured error details without crashing", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_structured_error",
          name: "actua_learn_content",
          toolType: "datasource",
          input: { question: "Storyline" },
          state: "error",
          result: "I encountered an issue while searching the knowledge base.",
          errorDetails: {
            error_type: "ProgrammingError",
            error_message:
              'column "app_id" of relation "usage_records" does not exist',
            traceback: "internal traceback",
          },
        }}
      />,
    )

    const card = within(view.container)
    expect(card.getByText("error")).toBeTruthy()
    expect(card.getByText(/column "app_id"/)).toBeTruthy()
  })

  it("renders generated office document files from metadata", () => {
    render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_3",
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
            ],
          },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Office documents: 1 file" }),
    )
    expect(
      screen.getByRole("link", { name: /monthly-report\.docx/ }),
    ).toBeTruthy()
  })

  it("renders a dedicated card for email_send tool calls", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_4",
          name: "email_sender",
          toolType: "email_send",
          input: {
            to: ["alex@example.com", "team@example.com"],
            subject: "Weekly update",
            text: "Hello team,\n\nHere is the status report.",
          },
          state: "completed",
          result: JSON.stringify({
            status: "SENT",
            recipients_count: 2,
            receipt: {
              provider: "resend",
              message_id: "msg_123",
            },
          }),
        }}
      />,
    )

    expect(screen.getByText("Weekly update")).toBeTruthy()
    expect(screen.getByText("alex@example.com")).toBeTruthy()
    expect(screen.getByText("team@example.com")).toBeTruthy()
    const emailCard = view.container.querySelector(
      '[data-tool-call-id="tool_4"]',
    )
    expect(emailCard).toBeTruthy()
    const emailCardQueries = within(emailCard as HTMLElement)
    const detailsPanel = emailCardQueries.getByTestId("email-send-details")
    expect(detailsPanel.className.includes("hidden")).toBe(true)
    expect(emailCardQueries.queryByText("Input")).toBeNull()
    expect(emailCardQueries.queryByText("Output")).toBeNull()

    const toggleButton = emailCardQueries.getByRole("button")
    expect(toggleButton.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(toggleButton)
    expect(toggleButton.getAttribute("aria-expanded")).toBe("true")
    expect(detailsPanel.className.includes("hidden")).toBe(false)

    expect(emailCardQueries.getByText("Delivery")).toBeTruthy()
    expect(emailCardQueries.getByText("SENT")).toBeTruthy()
    expect(emailCardQueries.getByText("resend")).toBeTruthy()
    expect(emailCardQueries.getByText("msg_123")).toBeTruthy()
  })
})
