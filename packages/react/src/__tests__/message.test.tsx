import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Message } from "../components"

describe("Message", () => {
  it("renders user text content", () => {
    render(
      <Message
        message={{
          id: "msg_1",
          role: "user",
          parts: [{ type: "text", text: "Hola mundo" }],
        }}
      />,
    )

    expect(screen.getByText("User")).toBeTruthy()
    expect(screen.getByText("Hola mundo")).toBeTruthy()
  })

  it("renders tool call details", () => {
    render(
      <Message
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

  it("renders input_file and input_image parts", () => {
    render(
      <Message
        message={{
          id: "msg_attachments",
          role: "user",
          parts: [
            {
              type: "input_image",
              url: "https://example.com/diagram.png",
              title: "diagram.png",
              metadata: { originalFileName: "diagram.png" },
            },
            {
              type: "input_file",
              fileUrl: "https://example.com/manual.pdf",
              title: "manual.pdf",
              mimeType: "application/pdf",
              metadata: { originalFileName: "manual.pdf" },
            },
            {
              type: "text",
              text: "Please review attachments",
            },
          ],
        }}
      />,
    )

    expect(screen.getByRole("img", { name: "diagram.png" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /manual\.pdf/i })).toBeTruthy()
    expect(screen.getByText("application/pdf")).toBeTruthy()
    expect(screen.getByText("Please review attachments")).toBeTruthy()
  })

  it("collapses long user prompts by default", () => {
    const text = "x".repeat(800)

    render(
      <Message
        message={{
          id: "msg_3",
          role: "user",
          parts: [{ type: "text", text }],
        }}
      />,
    )

    expect(screen.getByText("Read more")).toBeTruthy()
  })
})
