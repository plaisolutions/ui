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
    expect(screen.getByText("Status: completed")).toBeTruthy()
    expect(screen.getByText(/"q": "billing"/)).toBeTruthy()
  })
})
