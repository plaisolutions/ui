import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultBrowserCard", () => {
  it("expands the scraped preview with its source URL and scraper credits", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_browser_1",
          name: "Browser",
          toolType: "browser",
          input: { url: "https://example.com/article" },
          state: "completed",
          result: "Example article content.",
          metadata: {
            type: "browser",
            scraper_type: "firecrawl",
            firecrawl_credits: 2,
          },
        }}
      />,
    )

    const card = screen.getByRole("region", { name: "Browser result" })
    expect(within(card).getByText("Firecrawl · 2 credits")).toBeTruthy()

    fireEvent.click(
      within(card).getByRole("button", { name: "Expand browser result" }),
    )

    expect(
      within(card).getByRole("link", { name: "https://example.com/article" }),
    ).toBeTruthy()
    expect(within(card).getByText("Example article content.")).toBeTruthy()
    view.unmount()
  })

  it("shows error details in the expanded result", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_browser_error",
          name: "Browser",
          toolType: "browser",
          input: { url: "https://example.com" },
          state: "error",
          errorDetails: { message: "Website blocked the scraper" },
          metadata: { type: "browser" },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Expand browser result" }),
    )

    expect(screen.getByText(/Website blocked the scraper/)).toBeTruthy()
    view.unmount()
  })
})
