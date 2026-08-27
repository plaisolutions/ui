import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { MessageParts, Thinking } from "../components"

describe("Thinking", () => {
  afterEach(cleanup)

  it("shows an expanded, accessible summary while it is streaming", () => {
    render(
      <Thinking
        part={{
          type: "thinking",
          thinking: "Checking the relevant sources.",
          state: "streaming",
        }}
      />,
    )

    const toggle = screen.getByRole("button", { name: "Collapse Thinking…" })
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Checking the relevant sources.")).toBeTruthy()
    expect(screen.getByText("Thinking in progress")).toBeTruthy()
  })

  it("collapses completed summaries and lets the user expand them", () => {
    render(
      <Thinking
        part={{
          type: "thinking",
          thinking: "Checking the relevant sources.",
          state: "completed",
        }}
      />,
    )

    const toggle = screen.getByRole("button", {
      name: "Expand Thought process",
    })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("Checking the relevant sources.")).toBeNull()

    fireEvent.click(toggle)

    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Checking the relevant sources.")).toBeTruthy()
  })

  it("collapses a summary when streaming completes", () => {
    const { rerender } = render(
      <Thinking
        part={{
          type: "thinking",
          thinking: "Checking the relevant sources.",
          state: "streaming",
        }}
      />,
    )

    rerender(
      <Thinking
        part={{
          type: "thinking",
          thinking: "Checking the relevant sources.",
          state: "completed",
        }}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Expand Thought process" }),
    ).toBeTruthy()
    expect(screen.queryByText("Checking the relevant sources.")).toBeNull()
  })

  it("renders thinking parts in message order", () => {
    const view = render(
      <MessageParts
        message={{
          id: "msg_thinking",
          role: "assistant",
          parts: [
            {
              type: "thinking",
              thinking: "Checking the sources.",
              state: "completed",
            },
            { type: "text", text: "Here is the answer." },
          ],
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Thought process" }),
    )
    const content = view.container.textContent ?? ""
    expect(content.indexOf("Checking the sources.")).toBeLessThan(
      content.indexOf("Here is the answer."),
    )
  })
})
