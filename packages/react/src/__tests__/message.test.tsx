import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageParts,
} from "../components"

describe("Message composition", () => {
  it("composes a message from optional layout primitives", () => {
    const view = render(
      <Message align="start">
        <MessageAvatar src="" fallback="John Doe" />
        <MessageContent>
          <MessageHeader>John Doe</MessageHeader>
          <MessageParts
            message={{
              id: "msg_1",
              role: "user",
              parts: [{ type: "text", text: "Hola mundo" }],
            }}
          />
          <MessageFooter>Delivered</MessageFooter>
        </MessageContent>
      </Message>,
    )

    expect(screen.getByRole("img", { name: "John Doe" }).textContent).toBe(
      "JD",
    )
    expect(screen.getByText("Hola mundo")).toBeTruthy()
    expect(screen.getByText("Delivered")).toBeTruthy()
    expect(view.container.querySelector("article")?.className).toContain(
      "items-start",
    )
  })

  it("shows the image and falls back to at most two initials on error", () => {
    render(
      <MessageAvatar
        src="https://example.com/avatar.jpg"
        fallback="Ada Lovelace Byron"
      />,
    )

    const image = screen.getByRole("img", { name: "Ada Lovelace Byron" })
    expect(image.getAttribute("src")).toBe("https://example.com/avatar.jpg")
    fireEvent.error(image)
    expect(
      screen.getByRole("img", { name: "Ada Lovelace Byron" }).textContent,
    ).toBe("AB")
  })

  it("renders tool call details", () => {
    render(
      <MessageParts
        message={{
          id: "msg_2",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "tool_1",
              name: "search_docs",
              input: { q: "billing" },
              state: "completed",
              result: { count: 2 },
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("search_docs")).toBeTruthy()
    expect(screen.getByText("completed")).toBeTruthy()
    expect(screen.getByText(/"q": "billing"/)).toBeTruthy()
  })

  it("renders attachments and custom text/tool renderers", () => {
    const renderText = vi.fn((part: { text: string }) => (
      <strong>{part.text}</strong>
    ))
    render(
      <MessageParts
        renderText={renderText}
        message={{
          id: "msg_attachments",
          role: "user",
          parts: [
            {
              type: "input_image",
              url: "https://example.com/diagram.png",
              title: "diagram.png",
            },
            {
              type: "input_file",
              fileUrl: "https://example.com/manual.pdf",
              title: "manual.pdf",
              mimeType: "application/pdf",
            },
            { type: "text", text: "Please review attachments" },
          ],
        }}
      />,
    )

    expect(screen.getByRole("img", { name: "diagram.png" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /manual\.pdf/i })).toBeTruthy()
    expect(screen.getByText("Please review attachments").tagName).toBe("STRONG")
    expect(renderText).toHaveBeenCalled()
  })

  it("collapses long user prompts by default", () => {
    render(
      <MessageParts
        message={{
          id: "msg_3",
          role: "user",
          parts: [{ type: "text", text: "x".repeat(800) }],
        }}
      />,
    )
    expect(screen.getByText("Read more")).toBeTruthy()
  })

  it("can render datasource tool results before agent content", () => {
    const view = render(
      <MessageParts
        datasourceToolResultsPosition="before-content"
        message={{
          id: "msg_datasource_first",
          role: "assistant",
          parts: [
            { type: "text", text: "First agent paragraph" },
            {
              type: "tool-call",
              id: "tool_datasource_first",
              name: "search_courses",
              toolType: "datasource",
              input: { query: "Storyline" },
              state: "completed",
              result: { count: 2 },
            },
            { type: "text", text: "Final agent paragraph" },
          ],
        }}
      />,
    )

    const content = view.container.textContent ?? ""
    expect(content.indexOf("search_courses")).toBeLessThan(
      content.indexOf("First agent paragraph"),
    )
  })
})
