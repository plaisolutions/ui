import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ToolError } from "../components"

describe("ToolError", () => {
  afterEach(cleanup)

  it("renders a localized compact error collapsed by default", () => {
    const view = render(
      <ToolError
        locale="es-ES"
        part={{
          type: "tool-call",
          id: "tool_error",
          name: "actua_learn_content",
          toolType: "datasource",
          input: { question: "accesibilidad" },
          state: "error",
          result: "Search failed",
          errorDetails: { message: "Datasource unavailable" },
        }}
      />,
    )

    const toggle = screen.getByRole("button", {
      name: "Falló al usar la tool actua_learn_content",
    })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(view.container.querySelector("svg")).toBeTruthy()
    expect(view.container.querySelector("pre")).toBeNull()
  })

  it("reveals the input, output and error details on demand", () => {
    render(
      <ToolError
        part={{
          type: "tool-call",
          id: "tool_error",
          name: "web_search_actua_web",
          toolType: "perplexity",
          input: { query: "documentation" },
          state: "error",
          result: "The external service is unavailable.",
          errorDetails: { message: "Bad Request" },
        }}
      />,
    )

    const toggle = screen.getByRole("button", {
      name: "Failed to use tool web_search_actua_web",
    })
    fireEvent.click(toggle)

    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Input")).toBeTruthy()
    expect(screen.getByText("Output")).toBeTruthy()
    expect(screen.getByText("Error details")).toBeTruthy()
    expect(screen.getByText(/"query": "documentation"/)).toBeTruthy()
    expect(screen.getByText(/external service is unavailable/)).toBeTruthy()
    expect(screen.getByText("Bad Request")).toBeTruthy()
  })

  it("explains when the failed tool produced no output", () => {
    const view = render(
      <ToolError
        defaultOpen
        part={{
          type: "tool-call",
          id: "tool_error",
          name: "lookup_subscription",
          toolType: "unknown",
          input: {},
          state: "error",
        }}
      />,
    )

    expect(within(view.container).getByText("No output available")).toBeTruthy()
  })
})
