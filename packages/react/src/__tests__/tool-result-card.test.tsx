import { render, screen } from "@testing-library/react"
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
})
